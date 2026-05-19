"use strict";
(() => {
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // src/code.ts
  figma.showUI(__html__, {
    width: 1020,
    height: 593,
    themeColors: true
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
  function getAvailableStyles(family) {
    return __async(this, null, function* () {
      const fonts = yield figma.listAvailableFontsAsync();
      return fonts.filter((font) => font.fontName.family === family).map((font) => font.fontName.style);
    });
  }
  function hex(hexColor) {
    const hex2 = hexColor.replace("#", "");
    const bigint = parseInt(hex2, 16);
    return {
      r: (bigint >> 16 & 255) / 255,
      g: (bigint >> 8 & 255) / 255,
      b: (bigint & 255) / 255
    };
  }
  function rem(px) {
    return (px / 16).toFixed(2).replace(".00", "");
  }
  function createTextNode(characters, family, style, size, color = "#111111") {
    return __async(this, null, function* () {
      try {
        yield figma.loadFontAsync({ family, style });
      } catch (e) {
        try {
          yield figma.loadFontAsync({ family, style: "Regular" });
          style = "Regular";
        } catch (e2) {
          yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
          family = "Inter";
          style = "Regular";
        }
      }
      const text = figma.createText();
      try {
        text.fontName = { family, style };
      } catch (err) {
        try {
          text.fontName = { family: "Inter", style: "Regular" };
        } catch (err2) {
        }
      }
      text.characters = characters;
      text.fontSize = size;
      text.textAutoResize = "WIDTH_AND_HEIGHT";
      text.fills = [{
        type: "SOLID",
        color: hex(color)
      }];
      return text;
    });
  }
  figma.ui.onmessage = (msg) => __async(null, null, function* () {
    if (msg.type === "resize") {
      figma.ui.resize(msg.width, msg.height);
      return;
    }
    if (msg.type === "get-fonts") {
      try {
        const fonts = yield figma.listAvailableFontsAsync();
        const grouped = {};
        fonts.forEach((font) => {
          const family = font.fontName.family;
          const style = font.fontName.style;
          if (!grouped[family]) {
            grouped[family] = /* @__PURE__ */ new Set();
          }
          grouped[family].add(style);
        });
        const fontList = Object.keys(grouped).sort().map((family) => ({
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
      const styles = yield getAvailableStyles(msg.family);
      figma.ui.postMessage({
        type: "font-styles",
        styles
      });
      return;
    }
    if (msg.type !== "generate-system") return;
    try {
      let getSemanticName2 = function(prefix, indexInGroup, totalInGroup) {
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
      }, getCategoryForSize2 = function(size, mappings) {
        const sorted = [...mappings].sort((a, b) => b.minSize - a.minSize);
        for (const m of sorted) {
          if (size >= m.minSize) {
            return m;
          }
        }
        return sorted[sorted.length - 1] || { prefix: "Label", minSize: 0 };
      }, computeSemanticNames2 = function(scaleArr, mappings) {
        const mapped = scaleArr.map((size) => {
          const cat = getCategoryForSize2(size, mappings);
          return {
            size,
            prefix: cat.prefix
          };
        });
        const prefixCounts = {};
        mapped.forEach((item) => {
          prefixCounts[item.prefix] = (prefixCounts[item.prefix] || 0) + 1;
        });
        const prefixIndices = {};
        const names = scaleArr.map((size) => {
          const cat = getCategoryForSize2(size, mappings);
          const prefix = cat.prefix;
          const total = prefixCounts[prefix];
          const index = prefixIndices[prefix] || 0;
          prefixIndices[prefix] = index + 1;
          return getSemanticName2(prefix, index, total);
        });
        return names;
      };
      var getSemanticName = getSemanticName2, getCategoryForSize = getCategoryForSize2, computeSemanticNames = computeSemanticNames2;
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
      const semanticNames = computeSemanticNames2(scale, finalMappings);
      const styleMap = /* @__PURE__ */ new Map();
      let createdCount = 0;
      for (const weight of selectedWeights) {
        try {
          yield figma.loadFontAsync({
            family: fontFamily,
            style: weight
          });
        } catch (error) {
          continue;
        }
        for (let i = 0; i < scale.length; i++) {
          const size = scale[i];
          const style = figma.createTextStyle();
          style.name = `${device}/${fontFamily}/${semanticNames[i]}/${weight}`;
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
        root.fills = [{ type: "SOLID", color: hex("#F3F4F6") }];
        const titleBlock = figma.createFrame();
        titleBlock.name = "Header Block";
        titleBlock.layoutMode = "VERTICAL";
        titleBlock.itemSpacing = 8;
        titleBlock.counterAxisSizingMode = "AUTO";
        titleBlock.primaryAxisSizingMode = "AUTO";
        titleBlock.fills = [];
        const mainTitle = yield createTextNode(
          `${fontFamily} Typography System \u2014 ${device}`,
          fontFamily,
          defaultWeight,
          32,
          "#111827"
        );
        const subtitle = yield createTextNode(
          `Automated design system guidelines for the ${fontFamily} family on ${device}.`,
          "Inter",
          "Regular",
          15,
          "#6B7280"
        );
        titleBlock.appendChild(mainTitle);
        titleBlock.appendChild(subtitle);
        root.appendChild(titleBlock);
        const systemCard = figma.createFrame();
        systemCard.name = "Typography System Card";
        systemCard.layoutMode = "VERTICAL";
        systemCard.itemSpacing = 56;
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
        const groupedSizes = /* @__PURE__ */ new Map();
        for (let i = 0; i < scale.length; i++) {
          const cat = getCategoryForSize2(scale[i], finalMappings);
          const prefix = cat.prefix;
          if (!groupedSizes.has(prefix)) {
            groupedSizes.set(prefix, []);
          }
          groupedSizes.get(prefix).push({ index: i, size: scale[i], name: semanticNames[i] });
        }
        for (const [prefix, items] of groupedSizes.entries()) {
          const sectionContainer = figma.createFrame();
          sectionContainer.name = `${prefix} Section`;
          sectionContainer.layoutMode = "VERTICAL";
          sectionContainer.itemSpacing = 36;
          sectionContainer.counterAxisSizingMode = "AUTO";
          sectionContainer.primaryAxisSizingMode = "AUTO";
          sectionContainer.fills = [];
          const sectionHeader = figma.createFrame();
          sectionHeader.name = "Section Header";
          sectionHeader.layoutMode = "VERTICAL";
          sectionHeader.itemSpacing = 4;
          sectionHeader.counterAxisSizingMode = "AUTO";
          sectionHeader.primaryAxisSizingMode = "AUTO";
          sectionHeader.fills = [];
          const sectionTitle = yield createTextNode(
            `${prefix} Typography`,
            fontFamily,
            defaultWeight,
            22,
            "#111827"
          );
          const sectionSubtitle = yield createTextNode(
            `Generated sizes for the ${prefix} category.`,
            "Inter",
            "Regular",
            13,
            "#6B7280"
          );
          sectionHeader.appendChild(sectionTitle);
          sectionHeader.appendChild(sectionSubtitle);
          sectionContainer.appendChild(sectionHeader);
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
            const tagText = yield createTextNode(
              `${levelName} \xB7 ${size}px`,
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
                yield figma.loadFontAsync({ family: fontFamily, style: weight });
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
              const weightLabel = yield createTextNode(
                weight.toUpperCase(),
                "Inter",
                "Bold",
                11,
                "#9CA3AF"
              );
              const sample = yield createTextNode(
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
              const metaText = yield createTextNode(
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
  });
})();
