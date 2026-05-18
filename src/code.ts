
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
  try {
    await figma.loadFontAsync({family, style});
  } catch (e) {
    try {
      await figma.loadFontAsync({family, style: "Regular"});
      style = "Regular";
    } catch (e2) {
      await figma.loadFontAsync({family: "Inter", style: "Regular"});
      family = "Inter";
      style = "Regular";
    }
  }

  const text = figma.createText();
  try {
    text.fontName = {family,style};
  } catch (err) {
    try {
      text.fontName = {family: "Inter", style: "Regular"};
    } catch (err2) {
      // Fallback successful, do nothing
    }
  }
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
      const grouped: { [key: string]: Set<string> } = {};

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
      fontFamily = "Inter",
      selectedWeights = ["Regular"],
      baseSize = 16,
      ratio = 1.2,
      device = "Desktop",
      variantCount = 6,
      createDesign = false,
      rangeMappings = []
    } = msg;

    const scale = generateScale(
      Number(baseSize),
      Number(ratio),
      Number(variantCount)
    );

    // Get smart default mappings if empty
    let finalMappings = rangeMappings;
    if (!finalMappings || finalMappings.length === 0) {
      const max = scale[0] || 16;
      let heroThreshold = 38;
      let headingThreshold = 17;
      let paragraphThreshold = 12;
      let captionThreshold = 10;
      let labelThreshold = 8;
      
      if (max < 24) {
        heroThreshold = 999;
        headingThreshold = 15;
        paragraphThreshold = 12;
        captionThreshold = 10;
        labelThreshold = 8;
      } else if (max < 32) {
        heroThreshold = 28;
        headingThreshold = 16;
        paragraphThreshold = 12;
        captionThreshold = 10;
        labelThreshold = 8;
      }
      
      finalMappings = [
        { prefix: "Hero", minSize: heroThreshold },
        { prefix: "H", minSize: headingThreshold },
        { prefix: "P", minSize: paragraphThreshold },
        { prefix: "Caption", minSize: captionThreshold },
        { prefix: "Label", minSize: labelThreshold }
      ];
    }

    function getSemanticName(prefix: string, indexInGroup: number, totalInGroup: number) {
      const cleanPrefix = prefix.trim();
      const isSingleLetter = /^[hHpP]$/.test(cleanPrefix);

      if (isSingleLetter) {
        return `${cleanPrefix.toUpperCase()}${indexInGroup + 1}`;
      }

      if (totalInGroup === 1) {
        return cleanPrefix;
      }

      if (indexInGroup === 0) {
        return cleanPrefix;
      }

      return `${cleanPrefix} ${indexInGroup + 1}`;
    }

    function getCategoryForSize(size: number, mappings: any[]) {
      const sorted = [...mappings].sort((a, b) => b.minSize - a.minSize);
      for (const m of sorted) {
        if (size >= m.minSize) {
          return m;
        }
      }
      return sorted[sorted.length - 1] || { prefix: "Label", minSize: 0 };
    }

    function computeSemanticNames(scaleArr: number[], mappings: any[]) {
      const mapped = scaleArr.map((size) => {
        const cat = getCategoryForSize(size, mappings);
        return {
          size,
          prefix: cat.prefix
        };
      });

      const prefixCounts: { [key: string]: number } = {};
      mapped.forEach((item) => {
        prefixCounts[item.prefix] = (prefixCounts[item.prefix] || 0) + 1;
      });

      const prefixIndices: { [key: string]: number } = {};
      const names = scaleArr.map((size) => {
        const cat = getCategoryForSize(size, mappings);
        const prefix = cat.prefix;
        const total = prefixCounts[prefix];
        const index = prefixIndices[prefix] || 0;
        prefixIndices[prefix] = index + 1;

        return getSemanticName(prefix, index, total);
      });

      return names;
    }

    const semanticNames = computeSemanticNames(scale, finalMappings);
    const styleMap = new Map<string, string>();

    let createdCount = 0;

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
          `${device}/${fontFamily}/${semanticNames[i]}/${weight}`;

        style.fontName = {
          family: fontFamily,
          style: weight
        };

        style.fontSize = size;

        style.lineHeight = {
          unit: "PIXELS",
          value: Math.round(size * 1.2)
        };

        styleMap.set(`${i}_${weight}`, style.id);

        createdCount++;
      }
    }

    if (createDesign) {
      const defaultWeight = selectedWeights.length > 0 ? selectedWeights[0] : "Regular";

      // 1. Root page canvas frame
      const root = figma.createFrame();
      root.name = `${fontFamily} Typography Spec Sheet`;
      root.layoutMode = "VERTICAL";
      root.itemSpacing = 40;
      root.paddingTop = 80;
      root.paddingBottom = 80;
      root.paddingLeft = 80;
      root.paddingRight = 80;
      root.counterAxisSizingMode = "AUTO";
      root.primaryAxisSizingMode = "AUTO";
      root.fills = [{ type: "SOLID", color: hex("#F3F4F6") }]; // light gray background

      // Title & Subtitle container
      const titleBlock = figma.createFrame();
      titleBlock.name = "Header Block";
      titleBlock.layoutMode = "VERTICAL";
      titleBlock.itemSpacing = 8;
      titleBlock.counterAxisSizingMode = "AUTO";
      titleBlock.primaryAxisSizingMode = "AUTO";
      titleBlock.fills = [];

      const mainTitle = await createTextNode(
        `${fontFamily} Typography System — ${device}`,
        fontFamily,
        defaultWeight,
        32,
        "#111827"
      );

      const subtitle = await createTextNode(
        `Automated design system guidelines for the ${fontFamily} family on ${device}.`,
        "Inter",
        "Regular",
        15,
        "#6B7280"
      );

      titleBlock.appendChild(mainTitle);
      titleBlock.appendChild(subtitle);
      root.appendChild(titleBlock);

      // 2. The Single Master System Card (holds all categories)
      const systemCard = figma.createFrame();
      systemCard.name = "Typography System Card";
      systemCard.layoutMode = "VERTICAL";
      systemCard.itemSpacing = 56; // spacing between sections
      systemCard.paddingTop = 56;
      systemCard.paddingBottom = 56;
      systemCard.paddingLeft = 56;
      systemCard.paddingRight = 56;
      systemCard.cornerRadius = 24;
      systemCard.fills = [{ type: "SOLID", color: hex("#FFFFFF") }];
      systemCard.strokes = [{ type: "SOLID", color: hex("#E5E7EB") }];
      systemCard.strokeWeight = 1;
      systemCard.counterAxisSizingMode = "AUTO";
      systemCard.primaryAxisSizingMode = "AUTO";

      const groupedSizes = new Map<string, { index: number, size: number, name: string }[]>();
      for (let i = 0; i < scale.length; i++) {
        const cat = getCategoryForSize(scale[i], finalMappings);
        const prefix = cat.prefix;
        if (!groupedSizes.has(prefix)) {
          groupedSizes.set(prefix, []);
        }
        groupedSizes.get(prefix)!.push({ index: i, size: scale[i], name: semanticNames[i] });
      }

      for (const [prefix, items] of groupedSizes.entries()) {
        // Create an elegant section container inside the single card
        const sectionContainer = figma.createFrame();
        sectionContainer.name = `${prefix} Section`;
        sectionContainer.layoutMode = "VERTICAL";
        sectionContainer.itemSpacing = 36;
        sectionContainer.counterAxisSizingMode = "AUTO";
        sectionContainer.primaryAxisSizingMode = "AUTO";
        sectionContainer.fills = [];

        // Section header
        const sectionHeader = figma.createFrame();
        sectionHeader.name = "Section Header";
        sectionHeader.layoutMode = "VERTICAL";
        sectionHeader.itemSpacing = 4;
        sectionHeader.counterAxisSizingMode = "AUTO";
        sectionHeader.primaryAxisSizingMode = "AUTO";
        sectionHeader.fills = [];

        const sectionTitle = await createTextNode(
          `${prefix} Typography`,
          fontFamily,
          defaultWeight,
          22,
          "#111827"
        );

        const sectionSubtitle = await createTextNode(
          `Generated sizes for the ${prefix} category.`,
          "Inter",
          "Regular",
          13,
          "#6B7280"
        );

        sectionHeader.appendChild(sectionTitle);
        sectionHeader.appendChild(sectionSubtitle);
        sectionContainer.appendChild(sectionHeader);

        // Iterate over size items in this prefix group
        for (const item of items) {
          const { index: i, size, name: levelName } = item;
          const lineHeight = Math.round(size * 1.2);

          const sizeBlock = figma.createFrame();
          sizeBlock.name = `${levelName} Group`;
          sizeBlock.layoutMode = "VERTICAL";
          sizeBlock.itemSpacing = 28;
          sizeBlock.counterAxisSizingMode = "AUTO";
          sizeBlock.primaryAxisSizingMode = "AUTO";
          sizeBlock.fills = [];

          // Pill tag indicating size
          const tagContainer = figma.createFrame();
          tagContainer.layoutMode = "HORIZONTAL";
          tagContainer.counterAxisSizingMode = "AUTO";
          tagContainer.primaryAxisSizingMode = "AUTO";
          tagContainer.fills = [];

          const tag = figma.createFrame();
          tag.name = "Semantic Tag";
          tag.layoutMode = "HORIZONTAL";
          tag.paddingTop = 6;
          tag.paddingBottom = 6;
          tag.paddingLeft = 12;
          tag.paddingRight = 12;
          tag.cornerRadius = 999;
          tag.fills = [{ type: "SOLID", color: hex("#111827") }];
          tag.counterAxisSizingMode = "AUTO";
          tag.primaryAxisSizingMode = "AUTO";

          const tagText = await createTextNode(
            `${levelName} · ${size}px`,
            fontFamily,
            defaultWeight,
            12,
            "#FFFFFF"
          );
          tag.appendChild(tagText);
          tagContainer.appendChild(tag);
          sizeBlock.appendChild(tagContainer);

          for (const weight of selectedWeights) {
            try {
              await figma.loadFontAsync({ family: fontFamily, style: weight });
            } catch (error) {
              continue;
            }

            const previewBlock = figma.createFrame();
            previewBlock.name = `${levelName}-${weight}`;
            previewBlock.layoutMode = "VERTICAL";
            previewBlock.itemSpacing = 8;
            previewBlock.counterAxisSizingMode = "AUTO";
            previewBlock.primaryAxisSizingMode = "AUTO";
            previewBlock.fills = [];

            // Weight label
            const weightLabel = await createTextNode(
              weight.toUpperCase(),
              "Inter",
              "Bold",
              11,
              "#9CA3AF"
            );

            // Specimen text node
            const sample = await createTextNode(
              "Typography",
              fontFamily,
              weight,
              size,
              "#111111"
            );

            const styleId = styleMap.get(`${i}_${weight}`);
            if (styleId) {
              try {
                sample.textStyleId = styleId;
              } catch (e) {
                sample.lineHeight = { unit: "PIXELS", value: lineHeight };
              }
            } else {
              sample.lineHeight = { unit: "PIXELS", value: lineHeight };
            }

            // Metadata text node (Beautiful single-line text layout)
            const metaText = await createTextNode(
              `${size}px / ${rem(size)}rem    Line Height ${lineHeight}px    ${fontFamily} ${weight}`,
              "Inter",
              "Regular",
              12,
              "#6B7280"
            );

            previewBlock.appendChild(weightLabel);
            previewBlock.appendChild(sample);
            previewBlock.appendChild(metaText);

            sizeBlock.appendChild(previewBlock);
          }
          sectionContainer.appendChild(sizeBlock);
        }
        systemCard.appendChild(sectionContainer);
      }
      root.appendChild(systemCard);

      figma.currentPage.appendChild(root);
      figma.viewport.scrollAndZoomIntoView([root]);
    }

    figma.notify(`Created ${createdCount} typography styles`);

  } catch (error) {

    console.error(error);

    figma.notify("Typography generation failed.");
  }
};
