/**
 * India-specific location filter & normalizer for CyberDastak Opportunities
 * Strictly verifies that opportunities are based in India or explicitly India-eligible remote.
 */

const INDIAN_CITIES = [
  'bengaluru', 'bangalore', 'mumbai', 'delhi', 'new delhi', 'noida', 'greater noida',
  'gurugram', 'gurgaon', 'hyderabad', 'secunderabad', 'pune', 'chennai', 'kolkata',
  'ahmedabad', 'jaipur', 'kochi', 'cochin', 'thiruvananthapuram', 'trivandrum',
  'chandigarh', 'mohali', 'indore', 'bhopal', 'nagpur', 'coimbatore', 'bhubaneswar',
  'visakhapatnam', 'vizag', 'lucknow', 'kanpur', 'patna', 'vadodara', 'surat',
  'mysuru', 'mysore', 'mangalore', 'mangaluru', 'dehradun', 'guwahati'
];

const INDIAN_STATES = [
  'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh',
  'goa', 'gujarat', 'haryana', 'himachal pradesh', 'jharkhand', 'karnataka',
  'kerala', 'madhya pradesh', 'maharashtra', 'manipur', 'meghalaya', 'mizoram',
  'nagaland', 'odisha', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu',
  'telangana', 'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi ncr'
];

const EXCLUDED_COUNTRIES = [
  'united states', 'usa', 'u.s.', 'united kingdom', 'uk', 'u.k.', 'canada',
  'germany', 'australia', 'singapore', 'netherlands', 'france', 'poland',
  'ireland', 'switzerland', 'japan', 'brazil', 'spain', 'italy', 'sweden',
  'south africa', 'new zealand', 'philippines', 'nigeria', 'pakistan', 'bangladesh'
];

/**
 * Checks if a string or location structure is strictly India-based.
 * @param {Object} params
 * @param {string} params.title - Role title
 * @param {string} params.location - Plain text location (e.g. "Bengaluru, Karnataka, India")
 * @param {string} [params.country] - ISO country code (e.g. "IN" or "India")
 * @param {string} [params.description] - Description snippet
 * @returns {{ isIndia: boolean, locationText: string, isRemote: boolean, isInternship: boolean }}
 */
function evaluateIndiaEligibility({ title = '', location = '', country = '', description = '' }) {
  const tLow = (title || '').toLowerCase();
  const locLow = (location || '').toLowerCase();
  const descLow = (description || '').toLowerCase();
  const cLow = (country || '').toLowerCase();

  // 1. Detect if it's an internship
  const isInternship = (
    tLow.includes('intern') ||
    tLow.includes('trainee') ||
    tLow.includes('apprentice') ||
    locLow.includes('intern') ||
    descLow.includes('internship')
  );

  // 2. Detect Remote status
  const isRemote = (
    tLow.includes('remote') ||
    tLow.includes('work from home') ||
    tLow.includes('wfh') ||
    locLow.includes('remote') ||
    locLow.includes('work from home') ||
    locLow.includes('wfh')
  );

  // 3. Country code checks
  if (cLow === 'in' || cLow === 'ind' || cLow === 'india') {
    return {
      isIndia: true,
      locationText: formatLocation(location, isRemote),
      isRemote,
      isInternship
    };
  }

  // 4. If explicit foreign country is mentioned in location and NOT India
  const hasForeignCountry = EXCLUDED_COUNTRIES.some(fc => {
    // avoid matching if location also explicitly states India
    return (
      locLow.includes(fc) &&
      !locLow.includes('india') &&
      !INDIAN_CITIES.some(city => locLow.includes(city))
    );
  });

  if (hasForeignCountry && !locLow.includes('india')) {
    return { isIndia: false, locationText: '', isRemote, isInternship };
  }

  // 5. Match Indian cities
  for (const city of INDIAN_CITIES) {
    if (
      locLow.includes(city) ||
      tLow.includes(`in ${city}`) ||
      tLow.includes(`(${city})`) ||
      tLow.includes(`- ${city}`)
    ) {
      return {
        isIndia: true,
        locationText: formatLocation(location || capitalize(city) + ', India', isRemote),
        isRemote,
        isInternship
      };
    }
  }

  // 6. Match Indian states
  for (const state of INDIAN_STATES) {
    if (locLow.includes(state) || tLow.includes(state)) {
      return {
        isIndia: true,
        locationText: formatLocation(location || capitalize(state) + ', India', isRemote),
        isRemote,
        isInternship
      };
    }
  }

  // 7. Check if "India" or "IN" appears directly in location
  if (
    locLow.includes('india') ||
    locLow.includes(', in') ||
    locLow.endsWith(' in') ||
    tLow.includes('in india') ||
    tLow.includes('india')
  ) {
    return {
      isIndia: true,
      locationText: formatLocation(location || 'India', isRemote),
      isRemote,
      isInternship
    };
  }

  // 8. If Remote and specifically mentions India in description
  if (isRemote && (descLow.includes('india') || descLow.includes('inr') || descLow.includes('ist'))) {
    return {
      isIndia: true,
      locationText: 'Remote (India)',
      isRemote: true,
      isInternship
    };
  }

  return { isIndia: false, locationText: '', isRemote, isInternship };
}

function formatLocation(loc, isRemote) {
  let cleaned = (loc || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return isRemote ? 'Remote (India)' : 'India';
  if (isRemote && !cleaned.toLowerCase().includes('remote')) {
    return `${cleaned} (Remote)`;
  }
  return cleaned;
}

function capitalize(str) {
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

module.exports = {
  evaluateIndiaEligibility,
  INDIAN_CITIES,
  INDIAN_STATES
};
