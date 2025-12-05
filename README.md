# ChrysaLink — Lepidoptera Host Plant Explorer

<p align="center">
  <img src="frontend/public/navbar/logo.png" alt="ChrysaLink Logo" width="200"/>
</p>

<p align="center">
  <strong>An interactive web platform for exploring Lepidoptera species and their host plant relationships</strong>
</p>

<p align="center">
  <a href="https://chrysalink.vercel.app/">Live Site</a>
</p>

---

## Overview

ChrysaLink is a comprehensive web explorer that visualizes the intricate relationships between Lepidoptera species (butterflies and moths) and their host plants. Built with curated datasets and interactive visualizations, the platform serves researchers, educators, citizen scientists, and nature enthusiasts seeking to understand these essential ecological connections.

### Key Features

- **Species Database**: Searchable repository of Lepidoptera species with detailed host plant information
- **Interactive Visualizations**: Dynamic maps and network graphs illustrating species-plant relationships
- **Observation Records**: Community-contributed sightings and occurrence data
- **Educational Resources**: Accessible information for students, educators, and hobbyists

### Target Audience

- Biologists and ecologists conducting research on pollinator-plant interactions
- Educators developing curriculum on ecosystem relationships
- Citizen scientists contributing to biodiversity monitoring
- Gardeners and conservationists interested in native plantings

## Technology Stack

- **Frontend**: Vite, React, TypeScript
- **Backend**: Supabase (PostgreSQL database, Edge Functions)
- **Data Processing**: Node.js, CSV datasets
- **Deployment**: Vercel

## Repository Structure
```
├── frontend/          # React application source code
├── backend/           # Supabase functions and database schemas
│   ├── data/         # Curated datasets (CSV format)
│   └── docs/         # Database documentation and SQL schemas
```

## Local Development

To run a local development environment:
```bash
cd frontend
npm install
npm run dev
```

The development server will start at `http://localhost:5173` (or another available port).

**Note**: This repository contains the source code for the production website. For general exploration of species and host plant data, visit the [live site](https://chrysalink.vercel.app/).

## Contributing

We welcome contributions from the community! Here's how you can help:

### Reporting Issues
Open an issue with a clear description, steps to reproduce, and expected vs. actual behavior.

### Code Contributions
Submit pull requests with:
- Clear description of changes
- Relevant issue references
- Updated documentation if applicable

### Data Contributions
To improve or expand the dataset:
1. Add or modify CSV files in `backend/data/`
2. Include proper citations and data sources
3. Follow the schema documented in `backend/docs/supabase_db.sql`

## Data Sources & Attribution

Dataset documentation, sources, and attribution information can be found in:
- `backend/docs/supabase_db.sql` — Database schema and structure
- `backend/data/` — Raw datasets with source citations

## License

Please refer to the LICENSE file in the repository root. For questions about data usage or commercial applications, contact the maintainers via GitHub issues.

## Contact

- **Website**: [chrysalink.vercel.app](https://chrysalink.vercel.app/)
- **Issues & Questions**: Open an issue in this repository
- **Collaboration Inquiries**: Contact via GitHub issues

---

<p align="center">
  <em>ChrysaLink is dedicated to making Lepidoptera ecology accessible and discoverable.</em>
</p>