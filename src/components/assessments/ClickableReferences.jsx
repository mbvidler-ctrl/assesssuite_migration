import React from "react";
import { ExternalLink } from "lucide-react";

export default function ClickableReferences({ references }) {
  if (!references) return null;

  // Deduplicate references by trimming and comparing
  const deduplicateReferences = (text) => {
    const lines = text.split('\n');
    const uniqueLines = [];
    const seen = new Set();
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        uniqueLines.push(line);
        seen.add(trimmed.toLowerCase());
      } else if (!trimmed) {
        uniqueLines.push(line); // Keep empty lines for formatting
      }
    });
    
    return uniqueLines.join('\n');
  };

  const dedupedReferences = deduplicateReferences(references);

  // Function to detect if a line is a full citation
  const isFullCitation = (line) => {
    // Check if line contains author names, year, and journal info
    // e.g., "Cox, R. L., & Kable, A. (2009). Title. Journal, 31(4), 392-410."
    // More flexible pattern that matches various citation formats
    const citationPattern = /[A-Z][a-z]+.*\(\d{4}\).*\d+/;
    return citationPattern.test(line);
  };

  // Function to create a PubMed search URL from a citation
  const createPubMedSearchUrl = (citation) => {
    // Extract key parts for search (first author and year)
    const authorMatch = citation.match(/^([A-Z][a-z]+\s+[A-Z]{1,3})/);
    const yearMatch = citation.match(/\b(19|20)\d{2}\b/);
    
    if (authorMatch && yearMatch) {
      const searchQuery = `${authorMatch[1]} ${yearMatch[0]}`;
      return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(searchQuery)}`;
    }
    
    // Fallback to searching the whole citation
    return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(citation.substring(0, 100))}`;
  };

  // Function to detect and linkify references
  const linkifyReferences = (text) => {
    // Split by newlines to process each reference separately
    const lines = text.split('\n');
    
    return lines.map((line, lineIndex) => {
      if (!line.trim()) return <br key={lineIndex} />;
      
      // Regex patterns
      const doiPattern = /(doi:|DOI:)?\s*(10\.\d{4,}\/[^\s]+)/gi;
      const pmidPattern = /PMID:\s*(\d+)/gi;
      const urlPattern = /(https?:\/\/[^\s]+)/gi;
      
      let parts = [line];
      let hasExplicitLink = false;
      
      // Replace DOIs with links
      parts = parts.flatMap(part => {
        if (typeof part !== 'string') return part;
        
        const doiMatches = [...part.matchAll(doiPattern)];
        if (doiMatches.length === 0) return part;
        
        hasExplicitLink = true;
        const result = [];
        let lastIndex = 0;
        
        doiMatches.forEach((match, i) => {
          const doi = match[2];
          result.push(part.substring(lastIndex, match.index));
          result.push(
            <a
              key={`doi-${lineIndex}-${i}`}
              href={`https://doi.org/${doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
            >
              doi:{doi}
              <ExternalLink className="w-3 h-3" />
            </a>
          );
          lastIndex = match.index + match[0].length;
        });
        
        result.push(part.substring(lastIndex));
        return result;
      });
      
      // Replace PMIDs with links
      parts = parts.flatMap(part => {
        if (typeof part !== 'string') return part;
        
        const pmidMatches = [...part.matchAll(pmidPattern)];
        if (pmidMatches.length === 0) return part;
        
        hasExplicitLink = true;
        const result = [];
        let lastIndex = 0;
        
        pmidMatches.forEach((match, i) => {
          const pmid = match[1];
          result.push(part.substring(lastIndex, match.index));
          result.push(
            <a
              key={`pmid-${lineIndex}-${i}`}
              href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
            >
              PMID:{pmid}
              <ExternalLink className="w-3 h-3" />
            </a>
          );
          lastIndex = match.index + match[0].length;
        });
        
        result.push(part.substring(lastIndex));
        return result;
      });
      
      // Replace URLs with links
      parts = parts.flatMap(part => {
        if (typeof part !== 'string') return part;
        
        const urlMatches = [...part.matchAll(urlPattern)];
        if (urlMatches.length === 0) return part;
        
        hasExplicitLink = true;
        const result = [];
        let lastIndex = 0;
        
        urlMatches.forEach((match, i) => {
          const url = match[1];
          result.push(part.substring(lastIndex, match.index));
          result.push(
            <a
              key={`url-${lineIndex}-${i}`}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-1"
            >
              {url}
              <ExternalLink className="w-3 h-3" />
            </a>
          );
          lastIndex = match.index + match[0].length;
        });
        
        result.push(part.substring(lastIndex));
        return result;
      });
      
      // If no explicit links found and this looks like a full citation, make the whole line a search link
      if (!hasExplicitLink && isFullCitation(line)) {
        return (
          <div key={lineIndex} className="mb-2">
            <a
              href={createPubMedSearchUrl(line)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline inline-flex items-start gap-1 hover:bg-blue-50 rounded px-1 -mx-1 transition-colors"
            >
              <span>{line}</span>
              <ExternalLink className="w-3 h-3 mt-0.5 flex-shrink-0" />
            </a>
          </div>
        );
      }
      
      return (
        <div key={lineIndex} className="mb-2">
          {parts}
        </div>
      );
    });
  };

  return (
    <div className="text-slate-700 text-sm">
      {linkifyReferences(dedupedReferences)}
    </div>
  );
}