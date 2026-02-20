import type { Campus } from './types';

export const campuses: Campus[] = [
  // Public Universities
  { id: 'ug', name: 'University of Ghana', acronym: 'UG', location: 'Accra', domain: 'st.ug.edu.gh', primaryColor: '#002147', secondaryColor: '#C8A870', category: 'Public', latitude: 5.6506, longitude: -0.1870, radioName: 'Radio Univers 105.7', radioStreamUrl: 'https://stream.radio-univers.com/live', radioWebsite: 'https://radiounivers.ug.edu.gh' },
  { id: 'knust', name: 'Kwame Nkrumah University of Science and Technology', acronym: 'KNUST', location: 'Kumasi', domain: 'st.knust.edu.gh', primaryColor: '#006837', secondaryColor: '#FFC72C', category: 'Public', latitude: 6.6745, longitude: -1.5716, radioName: 'Focus FM 94.3', radioStreamUrl: 'https://stream.focusfm.com/live', radioWebsite: 'https://focusfmknust.com' },
  { id: 'ucc', name: 'University of Cape Coast', acronym: 'UCC', location: 'Cape Coast', domain: 'stu.ucc.edu.gh', primaryColor: '#E01212', secondaryColor: '#FFC72C', category: 'Public', latitude: 5.1036, longitude: -1.2825, radioName: 'Atlantic Radio 103.9', radioStreamUrl: 'https://stream.atlantic.com/live' },
  { id: 'uds', name: 'University for Development Studies', acronym: 'UDS', location: 'Tamale', domain: 'uds.edu.gh', primaryColor: '#008000', secondaryColor: '#DAA520', category: 'Public' },
  { id: 'uew', name: 'University of Education, Winneba', acronym: 'UEW', location: 'Winneba', domain: 'uew.edu.gh', primaryColor: '#CE1126', secondaryColor: '#FFFFFF', category: 'Public' },
  { id: 'upsa', name: 'University of Professional Studies, Accra', acronym: 'UPSA', location: 'Accra', domain: 'upsamail.edu.gh', primaryColor: '#003399', secondaryColor: '#DAA520', category: 'Public' },
  { id: 'umat', name: 'University of Mines and Technology', acronym: 'UMAT', location: 'Tarkwa', domain: 'umat.edu.gh', primaryColor: '#DAA520', secondaryColor: '#000000', category: 'Public' },
  { id: 'uhas', name: 'University of Health and Allied Sciences', acronym: 'UHAS', location: 'Ho', domain: 'uhas.edu.gh', primaryColor: '#4A90E2', secondaryColor: '#FFFFFF', category: 'Public' },
  { id: 'gimpa', name: 'Ghana Institute of Management and Public Administration', acronym: 'GIMPA', location: 'Accra', domain: 'gimpa.edu.gh', primaryColor: '#275D8B', secondaryColor: '#FFFFFF', category: 'Public' },

  // Technical Universities
  { id: 'atu', name: 'Accra Technical University', acronym: 'ATU', location: 'Accra', domain: 'atu.edu.gh', primaryColor: '#2E3192', secondaryColor: '#FFC72C', category: 'Technical' },
  { id: 'kstu', name: 'Kumasi Technical University', acronym: 'KsTU', location: 'Kumasi', domain: 'kstu.edu.gh', primaryColor: '#ED1C24', secondaryColor: '#FFFFFF', category: 'Technical' },
  { id: 'ktu', name: 'Koforidua Technical University', acronym: 'KTU', location: 'Koforidua', domain: 'ktu.edu.gh', primaryColor: '#00AEEF', secondaryColor: '#002147', category: 'Technical' },
  { id: 'tatu', name: 'Tamale Technical University', acronym: 'TaTU', location: 'Tamale', domain: 'tatu.edu.gh', primaryColor: '#F7941D', secondaryColor: '#000000', category: 'Technical' },
  { id: 'htu', name: 'Ho Technical University', acronym: 'HTU', location: 'Ho', domain: 'htu.edu.gh', primaryColor: '#009444', secondaryColor: '#FFFFFF', category: 'Technical' },
  { id: 'ttu', name: 'Takoradi Technical University', acronym: 'TTU', location: 'Takoradi', domain: 'ttu.edu.gh', primaryColor: '#FDB913', secondaryColor: '#000000', category: 'Technical' },

  // Private Universities
  { id: 'ashesi', name: 'Ashesi University', acronym: 'Ashesi', location: 'Berekuso', domain: 'ashesi.edu.gh', primaryColor: '#800000', secondaryColor: '#FFFFFF', category: 'Private' },
  { id: 'central', name: 'Central University', acronym: 'Central', location: 'Accra', domain: 'central.edu.gh', primaryColor: '#003366', secondaryColor: '#DAA520', category: 'Private' },
  { id: 'pentecost', name: 'Pentecost University', acronym: 'Pentecost', location: 'Accra', domain: 'pentecost.edu.gh', primaryColor: '#0033A0', secondaryColor: '#DAA520', category: 'Private' },
  { id: 'valley-view', name: 'Valley View University', acronym: 'VVU', location: 'Oyibi', domain: 'vvu.edu.gh', primaryColor: '#003DA5', secondaryColor: '#FFFFFF', category: 'Private' },
];
