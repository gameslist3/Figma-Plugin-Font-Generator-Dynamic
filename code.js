
figma.showUI(__html__, {
  width: 1020,
  height: 593,
  themeColors: true
});

function round(value) {
  return Math.round(value * 100) / 100;
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

  try {

    const fonts = await figma.listAvailableFontsAsync();

    const styles = fonts
      .filter(font => font.fontName.family === family)
      .map(font => font.fontName.style);

    return [...new Set(styles)];

  } catch (error) {

    console.error(error);

    return [
      "Thin",
      "Extra Light",
      "Light",
      "Regular",
      "Italic",
      "Medium",
      "Semi Bold",
      "Bold",
      "Extra Bold",
      "Black"
    ];
  }
}

function hex(hexColor) {
  const hex = hexColor.replace("#", "");
  const bigint = parseInt(hex, 16);

  return {
    r: ((bigint >> 16) & 255) / 255,
    g: ((bigint >> 8) & 255) / 255,
    b: (bigint & 255) / 255,
  };
}

function rem(px){
  return (px / 16).toFixed(2).replace('.00','');
}

async function createTextNode(
  characters,
  family,
  style,
  size,
  color="#111111"
){
  await figma.loadFontAsync({family, style: "Regular"}).catch(() => {});
  await figma.loadFontAsync({family,style});

  const text = figma.createText();
  text.fontName = {family,style};
  text.characters = characters;
  text.fontSize = size;
  text.textAutoResize = "WIDTH_AND_HEIGHT";
  text.fills = [{
    type:"SOLID",
    color:hex(color)
  }];

  return text;
}

figma.ui.onmessage = async (msg) => {

  if (msg.type === "get-fonts") {

    try {
      const fonts = await figma.listAvailableFontsAsync();
      const grouped = {};

      fonts.forEach((font) => {
        const family = font.fontName.family;
        const style = font.fontName.style;

        if (!grouped[family]) {
          grouped[family] = new Set();
        }

        grouped[family].add(style);
      });

      const fontList = Object.keys(grouped)
        .sort()
        .map((family) => ({
          family,
          styles: Array.from(grouped[family])
        }));

      figma.ui.postMessage({
        type: "fonts-data",
        fonts: fontList
      });

    } catch (error) {
      console.error(error);
    }

    return;
  }


  if (msg.type === "get-font-styles") {

    const styles = await getAvailableStyles(msg.family);

    figma.ui.postMessage({
      type: "font-styles",
      styles
    });

    return;
  }

  if (msg.type !== "generate-system") return;

  try {

    const {
      fontFamily,
      selectedWeights,
      sizes,
      device
    } = msg;

    const availableFonts = await figma.listAvailableFontsAsync();

    const familyStyles = availableFonts
      .filter(font => font.fontName.family === fontFamily)
      .map(font => font.fontName.style);

    if (!familyStyles.length) {
      figma.notify(`${fontFamily} is not available in Figma`);
      return;
    }

    let created = 0;

    for (const weight of selectedWeights) {

      try {
        await figma.loadFontAsync({
          family: fontFamily,
          style: weight
        });
      } catch (error) {
        continue;
      }

      for (let i = 0; i < scale.length; i++) {

        const size = scale[i];

        const style = figma.createTextStyle();

        style.name =
          `${device}/${fontFamily}/${semanticNames[i] || `H${i+1}`}/${weight}`;

        style.fontName = {
          family: fontFamily,
          style: matchedStyle
        };
        textStyle.fontSize = size;
        textStyle.lineHeight = {
          unit: 'PIXELS',
          value: Math.round(size * 1.35)
        };
        textStyle.letterSpacing = {
          unit: 'PERCENT',
          value: size >= 48 ? -4 : size >= 32 ? -2 : 0
        };

        created++;
      }
    }

    figma.notify(`Created ${created} typography styles`);
  } catch (error) {

    console.error(error);

    figma.notify("Typography generation failed.");
  }
};
