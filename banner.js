const chalk = require("chalk");
const figlet = require("figlet");

function createMatchingGradient(text) {

  const colors = [
    "#0066FF", 
    "#0088FF", 
    "#00AAFF", 
    "#00CCFF", 
    "#00EEFF"  
  ];
  
  // Split text into lines
  const lines = text.split("\n");
  let result = "";
  
  // Apply gradient to each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const coloredLine = applyMatchingGradientToLine(line, colors);
    result += coloredLine + (i < lines.length - 1 ? "\n" : "");
  }
  
  return result;
}

// Apply reference-style gradient to a single line
function applyMatchingGradientToLine(line, colors) {
  if (!line.length) return "";
  
  const result = [];
  const colorCount = colors.length;
  const visibleChars = line.replace(/\s/g, "").length;
  
  if (visibleChars === 0) return line;
  
  let visibleCharIndex = 0;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === " " || char === "\t") {
      // Preserve whitespace
      result.push(char);
    } else {
      // Calculate character's relative position in line
      const position = visibleCharIndex / visibleChars;
      
      // Calculate color index based on position
      const exactIndex = position * (colorCount - 1);
      const lowerIndex = Math.floor(exactIndex);
      const upperIndex = Math.min(lowerIndex + 1, colorCount - 1);
      const ratio = exactIndex - lowerIndex;
      
      // Interpolate between adjacent colors
      const color = interpolateColor(colors[lowerIndex], colors[upperIndex], ratio);
      
      // Apply interpolated color to character
      result.push(chalk.hex(color)(char));
      
      visibleCharIndex++;
    }
  }
  
  return result.join("");
}

// Function to interpolate between two hex colors
function interpolateColor(color1, color2, ratio) {
  // Convert hex color to RGB format
  const r1 = parseInt(color1.substring(1, 3), 16);
  const g1 = parseInt(color1.substring(3, 5), 16);
  const b1 = parseInt(color1.substring(5, 7), 16);
  
  const r2 = parseInt(color2.substring(1, 3), 16);
  const g2 = parseInt(color2.substring(3, 5), 16);
  const b2 = parseInt(color2.substring(5, 7), 16);
  
  // Interpolate RGB values
  const r = Math.round(r1 * (1 - ratio) + r2 * ratio);
  const g = Math.round(g1 * (1 - ratio) + g2 * ratio);
  const b = Math.round(b1 * (1 - ratio) + b2 * ratio);
  
  // Convert back to hex, ensuring 2-digit formatting
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// Main function to display the banner
function displayBanner() {
  const text = figlet.textSync("RPCHUBS", {
    font: "ANSI Shadow", 
    horizontalLayout: "full",
  });

  const gradientText = createMatchingGradient(text);

  console.log("\n" + gradientText + "\n");
  console.log(
    chalk.cyan(`
                   ${chalk.yellow("🧪 Sui Passport NFT Minter")}                
     📢  ${chalk.blue("Telegram Channel://t.me/RPC_Hubs")}`)
  );

  console.log(
    chalk.yellow("\n════════════════════════════════════════════════════════")
  );
  console.log(chalk.white(`Started at: ${new Date().toLocaleString()}`));
  console.log(
    chalk.yellow("════════════════════════════════════════════════════════\n")
  );
}
module.exports = { displayBanner };