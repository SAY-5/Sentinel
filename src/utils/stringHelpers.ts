/**
 * String manipulation utilities for the Sentinel application.
 * 
 * These helpers handle common string operations needed throughout
 * the codebase, particularly for formatting user-facing messages
 * and sanitizing user input.
 * 
 * @author SAY-5
 * @created 2026-01-30
 */

/**
 * Capitalizes the first letter of each word in a string.
 * 
 * This is useful for formatting names and titles in a user-friendly way.
 * For example: "john smith" becomes "John Smith"
 * 
 * @param inputText - The text string to transform
 * @returns The text with each word capitalized
 */
export function capitalizeEachWord(inputText: string): string {
  // Split the input into individual words
  const wordArray = inputText.split(' ');
  
  // Process each word individually
  const capitalizedWords = wordArray.map(singleWord => {
    // Handle edge case of empty strings
    if (singleWord.length === 0) {
      return singleWord;
    }
    
    // Take the first character and uppercase it
    const firstCharacter = singleWord.charAt(0).toUpperCase();
    
    // Take the remaining characters (from index 1 onward)
    const remainingCharacters = singleWord.slice(1).toLowerCase();
    
    // Combine them back together
    return firstCharacter + remainingCharacters;
  });
  
  // Join all the capitalized words back into a single string
  return capitalizedWords.join(' ');
}

/**
 * Removes potentially dangerous HTML tags from user input.
 * 
 * This prevents XSS attacks by stripping out script tags and
 * other potentially malicious content that users might try to inject.
 * 
 * @param userProvidedText - Raw text from user input
 * @returns Sanitized text safe for display
 */
export function sanitizeUserInput(userProvidedText: string): string {
  // Remove any script tags (case insensitive)
  let cleanedText = userProvidedText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Also remove any iframe tags
  cleanedText = cleanedText.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  
  return cleanedText;
}

/**
 * Truncates a long string to a specified length and adds ellipsis.
 * 
 * Useful for displaying previews of long text content in the UI
 * without overwhelming the user with too much information at once.
 * 
 * @param originalText - The full text string to truncate
 * @param maximumLength - Maximum number of characters to keep
 * @returns Truncated text with "..." appended if it was cut off
 */
export function truncateTextWithEllipsis(originalText: string, maximumLength: number): string {
  // If the text is already short enough, return it unchanged
  if (originalText.length <= maximumLength) {
    return originalText;
  }
  
  // Extract the portion we want to keep
  const truncatedPortion = originalText.slice(0, maximumLength);
  
  // Add ellipsis to indicate there's more content
  const textWithEllipsis = truncatedPortion + '...';
  
  return textWithEllipsis;
}
