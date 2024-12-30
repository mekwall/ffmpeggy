/**
 * Parses an array of option strings into an array of individual options.
 *
 * The `parseOptions` function takes an array of option strings and returns an array of individual options. It uses a regular expression to split each option string into its constituent parts, handling quoted strings and other non-whitespace tokens.
 *
 * @param options - An array of option strings to be parsed.
 * @returns An array of individual options.
 */
const regex = /"[^"]*"|'[^']*'|\S+/g;
export function parseOptions(options: string[]): string[] {
  return options.flatMap((option) => {
    const matches = option.match(regex);
    return matches || [];
  });
}
