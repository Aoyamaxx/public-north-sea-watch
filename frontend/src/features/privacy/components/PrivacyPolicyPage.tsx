import React, { useEffect } from 'react';
import Layout from '../../../components/layout/Layout';
import SEO from '../../../components/ui/SEO';
import BackToTop from '../../../components/ui/BackToTop';
import './PrivacyPolicyPage.css';

const PrivacyPolicyPage = () => {
  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <Layout>
      <SEO 
        title="Privacy Policy - North Sea Watch" 
        description="North Sea Watch Privacy Policy - Learn how we collect, use, and protect your personal information."
        canonicalUrl="/privacy-policy"
        robots="noindex, nofollow"
        jsonLd={{
          organization: {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "North Sea Watch",
            "url": "https://northseawatch.org"
          },
          webpage: {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Privacy Policy - North Sea Watch",
            "description": "North Sea Watch Privacy Policy - Learn how we collect, use, and protect your personal information.",
            "url": "https://northseawatch.org/privacy-policy",
            "isPartOf": {
              "@type": "WebSite",
              "name": "North Sea Watch",
              "url": "https://northseawatch.org"
            }
          }
        }}
      />
      
      <div className="privacy-policy-container">
        <div className="privacy-policy-header">
          <h1>Privacy Policy</h1>
          <p className="effective-date">Effective Date: 01.04.2025</p>
        </div>
        
        <div className="privacy-policy-intro">
          <p>
            At North Sea Watch, we are committed to protecting your privacy and ensuring that your personal data is processed 
            in compliance with applicable privacy laws, including the General Data Protection Regulation (GDPR). 
            This Privacy Policy outlines how North Sea Watch collects, uses, and protects your personal information. 
            Only North Sea Watch members have access to your personal data at this time.
          </p>
        </div>
        
        <div className="privacy-policy-toc">
          <h2>Table of Contents</h2>
          <ol>
            <li><a href="#section-1">Owner and Data Controller</a></li>
            <li><a href="#section-2">Types of Data Collected</a></li>
            <li><a href="#section-3">Mode and Place of Processing the Data</a></li>
            <li><a href="#section-4">The Purposes of Processing</a></li>
            <li><a href="#section-5">Cookie Policy</a></li>
            <li><a href="#section-6">Further Information for Users in the European Union</a></li>
            <li><a href="#section-7">Additional Information about Data Collection and Processing</a></li>
            <li><a href="#section-8">Definitions and Legal References</a></li>
          </ol>
        </div>
        
        <div id="section-1" className="privacy-policy-section">
          <h2>1. Owner and Data Controller</h2>
          <p><strong>Owner:</strong> North Sea Watch</p>
          <p><strong>Owner Contact Email:</strong> info@northseawatch.org</p>
        </div>
        
        <div id="section-2" className="privacy-policy-section">
          <h2>2. Types of Data Collected</h2>
          <p>North Sea Watch collects the following personal data:</p>
          <ul>
            <li><strong>IP Address:</strong> Your device's IP address.</li>
            <li><strong>Timestamp of Visit:</strong> The exact time and date of your visit.</li>
            <li><strong>Page URL:</strong> The URL of the page you visited.</li>
            <li><strong>User Agent String:</strong> Information about the browser, operating system, and device you use.</li>
            <li><strong>Device Type:</strong> Information about your device, such as whether you're using a desktop, mobile, or other types of devices.</li>
            <li><strong>Bot Detection Flag:</strong> A flag indicating whether the visit is from an automated bot.</li>
            <li><strong>Bot Agent Identifier:</strong> The identifier associated with the bot, if detected.</li>
            <li><strong>Country:</strong> Your country of origin when visiting the website.</li>
            <li><strong>Country Code:</strong> The country code associated with your country.</li>
            <li><strong>Region:</strong> The region (state or province) from which you are accessing the site.</li>
            <li><strong>Region Name:</strong> The specific name of the region (e.g., state, province).</li>
            <li><strong>City:</strong> The city you are visiting from.</li>
            <li><strong>ZIP Code:</strong> Your ZIP code or postal code.</li>
            <li><strong>Coordinates (Latitude, Longitude):</strong> The geographical coordinates associated with your visit.</li>
            <li><strong>Timezone:</strong> The timezone corresponding to your location.</li>
            <li><strong>Internet Service Provider (ISP):</strong> The ISP used to access our website.</li>
            <li><strong>Organization:</strong> The organization linked to the IP address, if applicable.</li>
            <li><strong>AS Number:</strong> The Autonomous System Number linked to your network.</li>
          </ul>
          <p>Some of this data is collected automatically when you visit our website, while other data is provided directly by you or inferred through your activity on the website.</p>
        </div>
        
        <div id="section-3" className="privacy-policy-section">
          <h2>3. Mode and Place of Processing the Data</h2>
          <h3>Methods of Processing</h3>
          <p>
            We take appropriate security measures to prevent unauthorized access, disclosure, modification, or destruction of your personal data. 
            Data processing is done using computers and/or IT-enabled tools, following organizational procedures related to the purposes stated in this policy. 
            Only North Sea Watch members involved in operations, support, and website management have access to your personal data.
          </p>
          <h3>Place of Processing</h3>
          <p>
            Data processing takes place at the operating offices of North Sea Watch, as well as by third-party service providers involved in website operations and maintenance. 
            These third-party service providers are strictly authorized to process the data on our behalf and for the purposes outlined in this policy.
          </p>
          <h3>Retention Period</h3>
          <p>
            Personal data will be processed and stored for as long as necessary to fulfill the purposes outlined in this policy, or until you request its deletion, whichever comes first.
          </p>
        </div>
        
        <div id="section-4" className="privacy-policy-section">
          <h2>4. The Purposes of Processing</h2>
          <p>Your personal data may be used for the following purposes:</p>
          <ul>
            <li><strong>Analytics and Research:</strong> To analyze user behavior, measure website performance, and improve the website experience.</li>
            <li><strong>Security:</strong> To prevent fraud, detect bots, and secure the website against unauthorized use.</li>
          </ul>
        </div>
        
        <div id="section-5" className="privacy-policy-section">
          <h2>5. Cookie Policy</h2>
          <p>
            North Sea Watch uses cookies to enhance user experience, track usage, and provide tailored content. 
            For more information on our cookie usage and how to manage your preferences, please refer to our [Cookie Policy].
          </p>
        </div>
        
        <div id="section-6" className="privacy-policy-section">
          <h2>6. Further Information for Users in the European Union</h2>
          <h3>Legal Basis of Processing</h3>
          <p>We process personal data under the following legal bases:</p>
          <ul>
            <li><strong>Consent:</strong> Where you have given consent to process your personal data for one or more specific purposes.</li>
            <li><strong>Contractual Necessity:</strong> When data processing is necessary for the performance of an agreement or pre-contractual obligations.</li>
            <li><strong>Legal Obligations:</strong> When processing is required to comply with legal obligations.</li>
            <li><strong>Legitimate Interests:</strong> When processing is necessary for the legitimate interests of North Sea Watch, including customer relationship management, marketing, and service improvement.</li>
          </ul>
          <h3>Retention of Data</h3>
          <p>We retain your data for as long as necessary to fulfill the purposes for which it was collected:</p>
          <ul>
            <li>For contract-related purposes, we retain data until the contract is fully performed.</li>
            <li>For legitimate interest purposes, we retain data for as long as necessary to achieve the goals of those interests.</li>
            <li>For consent-based data, we retain the data as long as the consent is valid, unless withdrawn earlier.</li>
          </ul>
          <p>
            Once the retention period expires, your data will be deleted, and you will no longer be able to exercise your GDPR rights in relation to that data.
          </p>
        </div>
        
        <div id="section-7" className="privacy-policy-section">
          <h2>7. Additional Information about Data Collection and Processing</h2>
          <h3>Data Sharing with Third Parties</h3>
          <p>
            Your personal data will not be rented or sold to third parties. However, it may be shared with third-party service providers 
            who help North Sea Watch in processing data and providing services. These third-party providers are authorized to process 
            data on our behalf and under our instructions.
          </p>
          <h3>Rights of Users</h3>
          <p>You have several rights under the GDPR:</p>
          <ul>
            <li><strong>Right to Access:</strong> You can request access to the personal data we hold about you.</li>
            <li><strong>Right to Rectification:</strong> You can request that we correct any inaccurate data.</li>
            <li><strong>Right to Erasure:</strong> You can request the deletion of your data.</li>
            <li><strong>Right to Data Portability:</strong> You can request your data be transferred to another controller.</li>
            <li><strong>Right to Withdraw Consent:</strong> You can withdraw your consent at any time.</li>
            <li><strong>Right to Object:</strong> You can object to the processing of your data for direct marketing purposes.</li>
          </ul>
          <p>
            To exercise these rights, please contact North Sea Watch using the contact details provided above.
          </p>
        </div>
        
        <div id="section-8" className="privacy-policy-section">
          <h2>8. Definitions and Legal References</h2>
          <dl>
            <dt>Personal Data</dt>
            <dd>Any information that can be used to identify a natural person, directly or indirectly.</dd>
            
            <dt>Usage Data</dt>
            <dd>Data collected automatically when using the website, such as IP address, browser type, page URLs, and interaction data.</dd>
            
            <dt>Data Subject</dt>
            <dd>The individual to whom the personal data pertains.</dd>
            
            <dt>Data Controller</dt>
            <dd>North Sea Watch is the controller of your personal data.</dd>
            
            <dt>Service</dt>
            <dd>The website and services provided by North Sea Watch.</dd>
          </dl>
        </div>
        
        <div className="privacy-policy-footer">
          <h2>Changes to This Privacy Policy</h2>
          <p>
            North Sea Watch reserves the right to make changes to this Privacy Policy at any time. 
            If any changes are made, the updated Privacy Policy will be posted on our website. 
            Please review this page regularly to stay informed of any updates.
          </p>
        </div>
      </div>
      <BackToTop showOffset={300} />
    </Layout>
  );
};

export default PrivacyPolicyPage; 