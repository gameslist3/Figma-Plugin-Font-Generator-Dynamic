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
      device,
      createPreview
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

    const previewTexts = [];



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

        if (createPreview) {
          previewTexts.push({
            weight,
            size,
            style: matchedStyle
          });
        }
      }
    }

    if (createPreview) {
      const page = figma.createPage();
      page.name = `${fontFamily} Typography Preview`;
      figma.currentPage = page;

      const frame = figma.createFrame();
      frame.name = 'Typography System';
      frame.resize(1440, Math.max(2200, previewTexts.length * 240));
      frame.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.97, b: 0.97 } }];
      frame.layoutMode = 'VERTICAL';
      frame.primaryAxisSizingMode = 'AUTO';
      frame.counterAxisSizingMode = 'AUTO';
      frame.paddingTop = 80;
      frame.paddingBottom = 80;
      frame.paddingLeft = 80;
      frame.paddingRight = 80;
      frame.itemSpacing = 72;
      page.appendChild(frame);

      const title = figma.createText();
      await figma.loadFontAsync({ family: fontFamily, style: familyStyles[0] });

      title.characters = 'Headings';
      title.fontName = { family: fontFamily, style: familyStyles[0] };
      title.fontSize = 28;
      title.fills = [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1 } }];
      frame.appendChild(title);

      const sorted = [...previewTexts].sort((a,b)=>b.size-a.size);

      for (let i = 0; i < sorted.length; i++) {
        const item = sorted[i];

        const section = figma.createFrame();
        section.layoutMode = 'VERTICAL';
        section.primaryAxisSizingMode = 'AUTO';
        section.counterAxisSizingMode = 'AUTO';
        section.itemSpacing = 20;
        section.fills = [];
        frame.appendChild(section);

        const label = figma.createText();
        await figma.loadFontAsync({ family: fontFamily, style: item.style });
        label.characters = `H${i+1}`;
        label.fontName = { family: fontFamily, style: item.style };
        label.fontSize = 28;
        label.fills = [{ type: 'SOLID', color: { r: 0.45, g: 0.48, b: 0.52 } }];
        section.appendChild(label);

        const heading = figma.createText();
        heading.characters = 'Typography';
        heading.fontName = { family: fontFamily, style: item.style };
        heading.fontSize = item.size;
        heading.lineHeight = { unit: 'PIXELS', value: Math.round(item.size * 1.2) };
        heading.fills = [{ type: 'SOLID', color: { r: 0.04, g: 0.06, b: 0.08 } }];
        section.appendChild(heading);

        const meta = figma.createText();
        const rem = (item.size / 16).toFixed(2).replace('.00','');
        const lh = Math.round(item.size * 1.2);
        meta.characters = `Size: ${item.size}px / ${rem}rem        Weight: ${item.style}        Line Height: ${lh}px`;
        meta.fontName = { family: fontFamily, style: familyStyles[0] };
        meta.fontSize = 18;
        meta.fills = [{ type: 'SOLID', color: { r: 0.35, g: 0.37, b: 0.4 } }];
        section.appendChild(meta);
      }
    }

    figma.notify(`Created ${created} typography styles`);
  } catch (error) {
    console.error(error);
    figma.notify('Failed to generate typography styles');
  }
};