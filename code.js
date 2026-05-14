figma.showUI(__html__, {
  width: 460,
  height: 760
});

function round(value) {
  return Math.round(value);
}

function generateScale(base, ratio, count) {
  const scale = [];

  let current = base;

  for (let i = 0; i < count; i++) {
    scale.unshift(round(current));
    current = current * ratio;
  }

  return scale;
}

async function getAvailableStyles(family) {

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

figma.ui.onmessage = async (msg) => {

  if (msg.type !== "generate-system") {
    return;
  }

  try {

    const {
      fontFamily,
      selectedWeights,
      baseSize,
      ratio,
      device,
      variantCount
    } = msg;

    const availableStyles =
      await getAvailableStyles(
        fontFamily
      );

    const validWeights =
      selectedWeights.filter(
        (weight) =>
          availableStyles.includes(weight)
      );

    if (validWeights.length === 0) {

      figma.notify(
        "No matching font styles found in Figma."
      );

      return;
    }

    const scale =
      generateScale(
        Number(baseSize),
        Number(ratio),
        Number(variantCount)
      );

    let createdCount = 0;

    for (const weight of validWeights) {

      try {

        await figma.loadFontAsync({
          family: fontFamily,
          style: weight
        });

      } catch (e) {

        console.log(
          "Skipping unavailable font:",
          weight
        );

        continue;
      }

      for (let i = 0; i < scale.length; i++) {

        const size = scale[i];

        const style =
          figma.createTextStyle();

        style.name =
          `${device}/Size-${i + 1}/${weight}`;

        style.fontName = {
          family: fontFamily,
          style: weight
        };

        style.fontSize = size;

        style.lineHeight = {
          unit: "PIXELS",
          value: Math.round(size * 1.4)
        };

        style.letterSpacing = {
          unit: "PERCENT",
          value: size >= 32 ? -2 : 0
        };

        createdCount++;
      }
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