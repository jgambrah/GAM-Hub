# **App Name**: GAM Hub

## Core Features:

- Multi-Tenant Firestore Structure: Firestore structure partitioned by university (KNUST, UG, UCC, etc.) for products and social feeds.
- Role-Based Access Control (RBAC): Implementation of RBAC with roles including student, staff, vendor, and admin, managed via custom claims.
- University-Restricted Authentication: Firebase Blocking Function (beforeCreate) to validate user email domains against the campuses collection. Blocking unauthorized sign-ups and ensuring right campus assignment.
- Product Listings: Allow vendors to list products associated with their vendor ID and campus ID. Product details include images, descriptions, prices, and availability.
- Social Feed: Enable students to share YouTube/TikTok links and create posts for networking within their campus. Implement moderation tools for inappropriate content.
- Admin Dashboard: Provide an admin interface for managing campuses, users, and vendors, with capabilities to approve vendor registrations.
- Personalized Recommendations Tool: Generative AI powered tool that uses a recommendation model based on user preferences and behavior.

## Style Guidelines:

- Primary color: Deep indigo (#3F51B5) to represent the intellectual environment of a university.
- Background color: Very light grey (#F5F5F5) to provide a clean and modern canvas.
- Accent color: Muted purple (#9575CD) as an analogous contrast to the primary color, to add some vibrance to secondary CTAs.
- Body text: 'PT Sans', a humanist sans-serif, combining a modern look and a little warmth or personality
- Headline font: 'Space Grotesk' for headers and titles for computerized and modern feel, for larger screens and clearer titles and headings.
- Use material design icons for a consistent and recognizable user experience.
- Employ a responsive grid system that adapts to different screen sizes, ensuring a seamless experience on both mobile and desktop devices.