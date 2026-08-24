


export function createPageUrl(pageName: string) {
    const suffixIndex = pageName.search(/[?#]/);
    const pathname = suffixIndex === -1 ? pageName : pageName.slice(0, suffixIndex);
    const suffix = suffixIndex === -1 ? '' : pageName.slice(suffixIndex);

    return '/' + pathname.toLowerCase().replace(/ /g, '-') + suffix;
}
