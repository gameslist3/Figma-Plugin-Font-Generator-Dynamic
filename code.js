figma.showUI(__html__, { width: 1020, height: 620, themeColors: true });

const normalize = (v) => String(v).toLowerCase().replace(/[^a-z0-9]/g, '');

async function getFontFamilies() {
  const fonts = await figma.listAvailableFontsAsync();
  const map = new Map();

  fonts.forEach((font) => {
    const family = font.fontName.family;
    const style = font.fontName.style;

    if (!map.has(family)) map.set(family, new Set());
    map.get(family).add(style);
  });

  return [...map.entries()]
    .map(([family, styles]) => ({
      family,
      styles: [...styles]
    }))
    .sort((a, b) => a.family.localeCompare(b.family));
}

function matchStyle(requested, availableStyles) {
  const req = normalize(requested);

  const exact = availableStyles.find(
    style => normalize(style) === req
  );

  if (exact) return exact;

  const aliases = {
    thin: ['thin', 'hairline'],
    extralight: ['extralight', 'ultralight'],
    light: ['light'],
    regular: ['regular', 'normal', 'roman', 'book'],
    medium: ['medium'],
    semibold: ['semibold', 'demibold'],
    bold: ['bold'],
    extrabold: ['extrabold', 'ultrabold', 'heavy'],
    black: ['black', 'heavy'],
    italic: ['italic']
  };

  for (const [key, values] of Object.entries(aliases)) {
    if (req.includes(key)) {
      const found = availableStyles.find(style =>
        values.some(v => normalize(style).includes(v))
      );

      if (found) return found;
    }
  }

  return availableStyles.includes('Regular') ? 'Regular' : availableStyles[0];
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'get-fonts') {
    const fonts = await getFontFamilies();
    figma.ui.postMessage({ type: 'fonts-data', fonts });
    return;
  }

  if (msg.type !== 'generate-system') return;

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
      const matchedStyle = matchStyle(weight, familyStyles);

      await figma.loadFontAsync({
        family: fontFamily,
        style: matchedStyle
      });

      for (let i = 0; i < sizes.length; i++) {
        const size = Number(sizes[i]);

        const textStyle = figma.createTextStyle();

        textStyle.name = `${device}/${fontFamily}/${weight}/${size}`;
        textStyle.fontName = {
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
    figma.notify('Failed to generate typography styles');
  }
};