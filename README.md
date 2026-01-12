# Transport ERP

Enterprise Logistics Management System built with React, TypeScript, and Vite.

## Features

- **LR Management**: Create, edit, and confirm LR (Lorry Receipt) entries
- **Challan Management**: Generate challans for confirmed LRs
- **POD Entry**: Track Proof of Delivery entries
- **Invoice Management**: Generate invoices with GST calculation
- **Payment Management**: Record payments and track outstanding amounts
- **Audit Log**: Complete audit trail of all system actions
- **Role-based Access Control**: Clerk, Supervisor, Accounts, and Admin roles

## Tech Stack

- React 18
- TypeScript
- Vite
- Lucide React (Icons)
- LocalStorage (Data persistence)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd transport-erp
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Demo Credentials

- **Clerk**: clerk1 / clerk123
- **Supervisor**: super1 / super123
- **Accounts**: accounts1 / acc123
- **Admin**: admin / admin123

## Project Structure

```
transport-erp/
├── src/
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # Entry point
│   └── vite-env.d.ts    # Vite type definitions
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tsconfig.json        # TypeScript configuration
└── package.json         # Dependencies and scripts
```

## License

Private project
