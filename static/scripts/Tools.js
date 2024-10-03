export function printQuantity(qty, name, unit='') {
    const space = unit === '°' ? '' : ' '
    console.log(`${name} = ${qty.toFixed(3)}${space}${unit}`);
}

export function extractNameOrNumber(input) {
    // Regex to match '433 Eros (A898 PA)' and extract name
    const numberNameRegex = /^\s+(\d+\s+[A-Za-z]+)\s+\(.*\)$/; 
    // Regex to match just the number
    const numberRegex = /^(\d+)/;

    // Try to match the name first
    let match = input.match(numberNameRegex);
    if (match) {
        return match[1];  // Return the name
    }

    // If no name match, try to match the number
    match = input.match(numberRegex);
    if (match) {
        return match[1];  // Return the number
    }

    // Return null if no match
    return null;
}
