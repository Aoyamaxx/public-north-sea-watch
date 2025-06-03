import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogType?: string;
  ogImage?: string;
  twitterCard?: string;
  jsonLd?: Record<string, any>;
  robots?: string;
}

/**
 * SEO component for page-level metadata
 * This component handles setting up proper meta tags for search engines and social sharing
 */
const SEO: React.FC<SEOProps> = ({
  title,
  description,
  canonicalUrl,
  ogType = 'website',
  ogImage = '/logo512.png',
  twitterCard = 'summary_large_image',
  jsonLd,
  robots = 'index, follow',
}) => {
  // Build full canonical URL if relative path is provided
  const fullCanonicalUrl = canonicalUrl 
    ? (canonicalUrl.startsWith('http') ? canonicalUrl : `https://northseawatch.org${canonicalUrl}`)
    : undefined;
    
  // Default Organization JSON-LD if not provided
  const defaultOrganizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "North Sea Watch",
    "url": "https://northseawatch.org",
    "logo": "https://northseawatch.org/logo512.png",
    "description": "North Sea Watch is dedicated to monitoring and researching the environmental impact of shipping in the North Sea region."
  };
  
  // Default Website JSON-LD if not provided
  const defaultWebsiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "North Sea Watch",
    "url": "https://northseawatch.org",
    "description": description
  };
  
  // Process and normalize JSON-LD data to ensure URL consistency
  const processJsonLd = (data: Record<string, any>) => {
    // Create a deep copy to avoid mutating the original data
    const processedData = JSON.parse(JSON.stringify(data));
    
    // Process each type of schema
    Object.keys(processedData).forEach(key => {
      const item = processedData[key];
      
      // For WebPage schema, ensure URL matches canonical URL if on the same page
      if (item["@type"] === "WebPage" && fullCanonicalUrl && item.url) {
        // Only update if URL is for the current page (ends with canonicalUrl path)
        if (canonicalUrl && item.url.endsWith(canonicalUrl)) {
          item.url = fullCanonicalUrl;
        }
      }
      
      // For WebSite keep the root URL
      if (item["@type"] === "WebSite") {
        // WebSite should always point to the root domain
        item.url = "https://northseawatch.org";
      }
      
      // Handle nested objects that might contain URLs
      if (item.isPartOf && typeof item.isPartOf === 'object' && item.isPartOf["@type"] === "WebSite") {
        item.isPartOf.url = "https://northseawatch.org";
      }
    });
    
    return processedData;
  };
  
  // Use provided JSON-LD or defaults, then process for URL consistency
  const rawStructuredData = jsonLd || {
    organization: defaultOrganizationJsonLd,
    website: defaultWebsiteJsonLd
  };
  
  // Process the JSON-LD data to ensure URL consistency
  const structuredData = processJsonLd(rawStructuredData);

  return (
    <Helmet>
      {/* Basic metadata */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      
      {/* Canonical URL */}
      {fullCanonicalUrl && <link rel="canonical" href={fullCanonicalUrl} />}
      
      {/* Open Graph metadata */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      {fullCanonicalUrl && <meta property="og:url" content={fullCanonicalUrl} />}
      <meta property="og:image" content={ogImage} />
      
      {/* Twitter Card metadata */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      
      {/* Favicon links - multiple sizes for different devices */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="manifest" href="/manifest.json" />
      <meta name="msapplication-TileColor" content="#2b5797" />
      <meta name="theme-color" content="#ffffff" />
      
      {/* Structured Data JSON-LD */}
      {Object.values(structuredData).map((data, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO; 