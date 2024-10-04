export function printQuantity(qty, name, unit='') {
    const space = unit === '°' ? '' : ' '
    console.log(`${name} = ${qty.toFixed(3)}${space}${unit}`);
}

/**
 * Extract the name or number from a given string input.
 * This function uses regular expressions to extract either the name and number of a celestial object 
 * (e.g., '433 Eros') or just the number (e.g., '433') from an input string.
 * 
 * The function first attempts to match a pattern like '433 Eros (A898 PA)' and extract both the number 
 * and name. If this fails, it will try to extract just the number from the input.
 * 
 * @param {string} input - The string input containing the object's name or number.
 * @returns {string|null} - Returns the extracted name/number or `null` if no match is found 
 *                          or the input is not a string.
 * 
 * @example
 * // Returns '433 Eros'
 * extractNameOrNumber(' 433 Eros (A898 PA)');
 * 
 * @example
 * // Returns '433'
 * extractNameOrNumber('433');
 * 
 * @example
 * // Returns null
 * extractNameOrNumber(123);  // Non-string input
 */
export function extractNameOrNumber(input) {
    // Ensure input is a string before processing
    if (typeof input !== 'string') {
        console.warn('Expected a string input, but received:', input);
        return null;
    }

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
