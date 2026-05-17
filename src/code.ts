
figma.showUI(__html__, {
  width: 1020,
  height: 593,
  themeColors: true
});

function round(value: number) {
  return Math.round(value);
}

function generateScale(base: number, ratio: number, count: number) {
  const scale: number[] = [];
  let current = base;

  for (let i = 0; i < count; i++) {
    scale.unshift(round(current));
    current = current * ratio;
  }

  return scale;
}

async function getAvailableStyles(family: string) {
  const fonts = await figma.listAvailableFontsAsync();

  return fonts
    .filter((font) => font.fontName.family === family)
    .map((font) => font.fontName.style);
}

function hex(hexColor: string) {
  const hex = hexColor.replace("#", "");
  const bigint = parseInt(hex, 16);

  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

function rem(px:number){
  return (px / 16).toFixed(2).replace('.00','');
}

async function createTextNode(
  characters:string,
  family:string,
  style:string,
  size:number,
  color="#111111"
){
  await figma.loadFontAsync({family,style});

  const text = figma.createText();
  text.characters = characters;
  text.fontName = {family,style};
  text.fontSize = size;
  text.fills = [{
    type:"SOLID",
    color:hex(color)
  }];

  return text;
}

figma.ui.onmessage = async (msg) => {

  if (msg.type !== "generate-system") return;

  try {

    const {
      fontFamily = "Inter",
      selectedWeights = ["Regular"],
      baseSize = 16,
      ratio = 1.2,
      device = "Desktop",
      variantCount = 6,
      createDesign = false
    } = msg;

    const scale = generateScale(
      Number(baseSize),
      Number(ratio),
      Number(variantCount)
    );

    const semanticNames = [
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6"
    ];

    let createdCount = 0;

    for (const weight of selectedWeights) {

      try {
        await figma.loadFontAsync({
          family: fontFamily,
          style: weight
        });
      } catch {
        continue;
      }

      for (let i = 0; i < scale.length; i++) {

        const size = scale[i];

        const style = figma.createTextStyle();

        style.name =
          `${device}/${fontFamily}/${semanticNames[i] || `H${i+1}`}/${weight}`;

        style.fontName = {
          family: fontFamily,
          style: weight
        };

        style.fontSize = size;

        style.lineHeight = {
          unit: "PIXELS",
          value: Math.round(size * 1.2)
        };

        createdCount++;
      }
    }

    if (createDesign) {

      const root = figma.createFrame();

      root.name = `${fontFamily} Typography System`;

      root.layoutMode = "HORIZONTAL";
      root.itemSpacing = 48;
      root.paddingTop = 80;
      root.paddingBottom = 80;
      root.paddingLeft = 80;
      root.paddingRight = 80;

      root.counterAxisSizingMode = "AUTO";
      root.primaryAxisSizingMode = "AUTO";

      root.fills = [{
        type:"SOLID",
        color:hex("#F3F4F6")
      }];

      const categories = [
        {
          name:"Headings",
          items:semanticNames
        }
      ];

      for(const category of categories){

        const categoryFrame = figma.createFrame();

        categoryFrame.name = category.name;

        categoryFrame.layoutMode = "VERTICAL";
        categoryFrame.counterAxisSizingMode = "AUTO";
        categoryFrame.primaryAxisSizingMode = "AUTO";
        categoryFrame.itemSpacing = 64;

        categoryFrame.paddingTop = 40;
        categoryFrame.paddingBottom = 40;
        categoryFrame.paddingLeft = 40;
        categoryFrame.paddingRight = 40;

        categoryFrame.cornerRadius = 24;

        categoryFrame.fills = [{
          type:"SOLID",
          color:hex("#FFFFFF")
        }];

        const categoryTitle = await createTextNode(
          category.name,
          fontFamily,
          "Regular",
          28
        );

        categoryFrame.appendChild(categoryTitle);

        for(const weight of selectedWeights){

          const weightFrame = figma.createFrame();

          weightFrame.name = weight;

          weightFrame.layoutMode = "VERTICAL";
          weightFrame.counterAxisSizingMode = "AUTO";
          weightFrame.primaryAxisSizingMode = "AUTO";
          weightFrame.itemSpacing = 56;

          weightFrame.fills = [];

          const weightTitle = await createTextNode(
            weight,
            fontFamily,
            "Regular",
            20,
            "#6B7280"
          );

          weightFrame.appendChild(weightTitle);

          for(let i=0;i<scale.length;i++){

            const size = scale[i];
            const lineHeight = Math.round(size * 1.2);

            const block = figma.createFrame();

            block.layoutMode = "VERTICAL";
            block.counterAxisSizingMode = "AUTO";
            block.primaryAxisSizingMode = "AUTO";
            block.itemSpacing = 18;

            block.fills = [];

            const label = await createTextNode(
              semanticNames[i] || `H${i+1}`,
              fontFamily,
              "Regular",
              16,
              "#6B7280"
            );

            const sample = await createTextNode(
              semanticNames[i],
              fontFamily,
              weight,
              size
            );

            sample.lineHeight = {
              unit:"PIXELS",
              value:lineHeight
            };

            const meta = await createTextNode(
              `Size ${size}px / ${rem(size)}rem      Weight ${weight}      Line Height ${lineHeight}px / ${rem(lineHeight)}rem`,
              fontFamily,
              "Regular",
              14,
              "#6B7280"
            );

            block.appendChild(label);
            block.appendChild(sample);
            block.appendChild(meta);

            weightFrame.appendChild(block);
          }

          categoryFrame.appendChild(weightFrame);
        }

        root.appendChild(categoryFrame);
      }

      figma.currentPage.appendChild(root);
      figma.viewport.scrollAndZoomIntoView([root]);
    }

    figma.notify(`Created ${createdCount} typography styles`);

  } catch (error) {

    console.error(error);

    figma.notify("Typography generation failed.");
  }
};
