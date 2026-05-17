
figma.showUI(__html__, {
  width: 1020,
  height: 593,
  themeColors: true
});

function round(value: number) {
  return Math.round(value);
}

function generateScale(
  base: number,
  ratio: number,
  count: number
) {

  const scale: number[] = [];

  let current = base;

  for (let i = 0; i < count; i++) {

    scale.unshift(
      round(current)
    );

    current =
    current * ratio;

  }

  return scale;
}

async function getAvailableStyles(
  family: string
) {

  const fonts =
  await figma.listAvailableFontsAsync();

  return fonts
    .filter(
      (font) =>
      font.fontName.family === family
    )
    .map(
      (font) =>
      font.fontName.style
    );
}

function hex(hexColor: string) {

  const hex =
  hexColor.replace("#","");

  const bigint =
  parseInt(hex,16);

  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

figma.ui.onmessage =
async (msg) => {

  if (
    msg.type !==
    "generate-system"
  ) {
    return;
  }

  try {

    const {

      fontFamily = "Inter",
      selectedWeights = ["Regular"],
      baseSize = 16,
      ratio = 1.2,
      device = "Desktop",
      variantCount = 8,
      createDesign = false

    } = msg;

    const availableStyles =
    await getAvailableStyles(
      fontFamily
    );

    const scale =
    generateScale(
      Number(baseSize),
      Number(ratio),
      Number(variantCount)
    );

    let createdCount = 0;

    for (
      const weight of selectedWeights
    ) {

      const matched =
      availableStyles.find(
        style =>
        style.toLowerCase()
        .replace(/\s/g,"") ===
        weight.toLowerCase()
        .replace(/\s/g,"")
      ) || "Regular";

      try {

        await figma.loadFontAsync({
          family: fontFamily,
          style: matched
        });

      } catch (e) {

        continue;
      }

      for (
        let i = 0;
        i < scale.length;
        i++
      ) {

        const size =
        scale[i];

        const style =
        figma.createTextStyle();

        style.name =
        `${device}/${fontFamily}/Size-${i + 1}/${weight}`;

        style.fontName = {
          family: fontFamily,
          style: matched
        };

        style.fontSize =
        size;

        style.lineHeight = {
          unit: "PIXELS",
          value: Math.round(size * 1.2)
        };

        style.letterSpacing = {
          unit: "PERCENT",
          value: 0
        };

        createdCount++;
      }
    }

    if (createDesign) {

      const frame =
      figma.createFrame();

      frame.name =
      `${fontFamily} Typography Preview`;

      frame.resize(
        1440,
        2200
      );

      frame.fills = [{
        type: "SOLID",
        color: hex("#F7F7F7")
      }];

      frame.layoutMode =
      "VERTICAL";

      frame.counterAxisSizingMode =
      "AUTO";

      frame.primaryAxisSizingMode =
      "AUTO";

      frame.paddingTop = 64;
      frame.paddingBottom = 64;
      frame.paddingLeft = 64;
      frame.paddingRight = 64;

      frame.itemSpacing = 80;

      await figma.loadFontAsync({
        family: fontFamily,
        style: "Regular"
      });

      const title =
      figma.createText();

      title.characters =
      "Headings";

      title.fontName = {
        family: fontFamily,
        style: "Regular"
      };

      title.fontSize = 24;

      frame.appendChild(title);

      for (
        let i = 0;
        i < scale.length;
        i++
      ) {

        const size =
        scale[i];

        const section =
        figma.createFrame();

        section.layoutMode =
        "VERTICAL";

        section.counterAxisSizingMode =
        "AUTO";

        section.primaryAxisSizingMode =
        "AUTO";

        section.itemSpacing = 20;

        section.fills = [];

        const label =
        figma.createText();

        label.characters =
        `H${i + 1}`;

        label.fontName = {
          family: fontFamily,
          style: "Regular"
        };

        label.fontSize = 36;

        section.appendChild(label);

        const heading =
        figma.createText();

        heading.characters =
        "Typography";

        heading.fontName = {
          family: fontFamily,
          style: "Regular"
        };

        heading.fontSize =
        size;

        heading.lineHeight = {
          unit: "PIXELS",
          value: size * 1.2
        };

        section.appendChild(
          heading
        );

        const meta =
        figma.createText();

        meta.characters =
        `Size: ${size}px    Weight: Regular    Line Height: ${Math.round(size * 1.2)}px`;

        meta.fontName = {
          family: fontFamily,
          style: "Regular"
        };

        meta.fontSize = 16;

        meta.fills = [{
          type:"SOLID",
          color:hex("#697080")
        }];

        section.appendChild(meta);

        frame.appendChild(
          section
        );

      }

      figma.currentPage.appendChild(
        frame
      );

      figma.viewport.scrollAndZoomIntoView(
        [frame]
      );

    }

    figma.notify(
      `Created ${createdCount} typography styles`
    );

  } catch (error) {

    console.error(error);

    figma.notify(
      "Typography generation failed."
    );
  }
};
