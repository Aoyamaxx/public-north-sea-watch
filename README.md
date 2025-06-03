# North Sea Watch

North Sea Watch is a digital platform designed to monitor and visualise maritime emissions and environmental challenges in the North Sea region. The platform integrates real-time vessel data, marine pollution information, and policy updates to provide a comprehensive tool for stakeholders, policymakers, and the general public.

## Project Overview

The North Sea Watch platform aims to address the environmental impact of scrubber water discharge from ships by:
- Visualising real-time ship traffic and emissions data.
- Providing interactive maps and dashboards for monitoring pollution.
- Serving as a digital intervention tool to facilitate informed decision-making on maritime environmental regulations.
- Integrating both quantitative AIS data and qualitative policy and stakeholder insights.

## Setting Up Development Environment with Docker

1. Ensure that Docker is installed and running on your machine.
2. Clone the repository and navigate to the frontend or backend directory:

   ```sh
   git clone https://github.com/NorthSeaWatch/north-sea-watch
   ```
   ```sh
   cd north-sea-watch
   ```
   then
   ```sh
   cd backend
   ```
   or
   ```sh
   cd frontend
   ```
4. Start the development environment using Docker Compose:
   ```sh
   docker compose build --no-cache
   ```
   ```sh
   docker compose up
   ```
5. Once built, access the backend at [http://localhost:8000/](http://localhost:8000/) (Django Backend Home), [http://localhost:8000/admin](http://localhost:8000/admin) (Django Admin) and [http://localhost:8000/api/v1](http://localhost:8000/api/v1) (Django API).
6. Access the frontend at [http://localhost:3000/](http://localhost:3000/).
7. Both frontend and backend support hot reloading; changes to local files will reflect in the running containers.
8. To stop the development environment, use:
   ```sh
   docker compose down
   ``` 
   or simply press `Ctrl + C`.

## Version Control and Collaborative Working

This project follows a structured **Git-based version control and collaborative workflow** to ensure efficient development, clear version management, and stable releases.

---

### **1. Git Branching Strategy**
Team should follow a **Trunk-Based Development** approach with feature branches. The primary branches in the repository are:

#### **Main Branch (`main`)**
- The production-ready, stable branch.
- Only code that has passed **all tests and reviews** should be merged.
- Protected against direct pushes; requires **PR review & CI/CD validation**.

#### **Feature Branches (`feature/*`)**
- Used for new features, enhancements, or experimental code.
- Must be based on `main` and merged back via **Pull Requests (PRs)**.
- Example: `feature/user-auth`, `feature/dashboard-improvements`

#### **Bug Fix Branches (`bugfix/*`)**
- Used to fix bugs.
- Example: `bugfix/fix-login-issue`

#### **Release Branches (`release/*`)**
- Used for versioning and pre-release stabilization.
- Created from `main` before a major release.
- Example: `release/v1.0.0`

---

### **2. Git Commit and Pull Request Workflow**
#### **Step-by-Step Workflow for Everyone:**

1. **Update `main` locally**
   ```sh
   git checkout main
   ```
   
   ```sh
   git pull origin main
   ```

2. **Create a new feature branch**
   ```sh
   git checkout -b feature/my-new-feature
   ```
   
   or if feature branch already exist
   ```sh
   git checkout feature/my-new-feature
   ```

3. **Develop and commit changes**
   ```sh
   git add .
   ```

   ```sh
   git commit -m "hello"
   ```

4. **Push the branch to the remote repository**
   ```sh
   git push origin feature/my-new-feature
   ```
   **DO NOT push directly to the `main` branch.**

6. **Create a Pull Request (PR) in GitHub**
   - PR must be **reviewed and approved** before merging into `main`.
   - Ensure CI/CD tests pass before merging. (after the production version is deployed on server)

### **3. Versioning Policy (Semantic Versioning - SemVer)**
We use **Semantic Versioning (SemVer)** for releases:
```sh
MAJOR.MINOR.PATCH
```
- MAJOR (`X.0.0`): Incompatible changes, breaking API changes.
- MINOR (`X.0.0`): New features, backward-compatible enhancements.
- PATCH (`X.0.0`): Bug fixes, small improvements.

**Tagging Releases**
Each release version is tagged for easy rollback and history tracking:
```sh
git tag -a v1.0.0 -m "initial stable release"
```
```sh
git push origin v1.0.0
```

### **4. CI/CD Integration**
Future features...

## Technical Stack

The project is intended to use modern and scalable tech stacks, including:

- **Frontend:**
  - **React:** For building interactive user interfaces.
  - **Mapbox GL JS:** For dynamic map visualisations such as heatmaps and port visualisations, with Mapbox MVT for optimisation.

- **Backend:**
  - **Django:** As the primary web framework.
  - **Django REST Framework:** For API endpoints.
  - **Nginx:** As a reverse proxy server.

- **Environment / Deployment:**
  - **Docker:** For containerisation of the application and a better life without environment issue.
  - **ASGI Uvicorn:** For asynchronous server support.
  - **GitHub Actions (CI/CD):** For automated redeployment.
  - **Server:** Hosted on Google VM or Google Cloud Run.

- **Database:**
  - **Cloud PostgreSQL:** For secure and scalable data storage.

- **Mapping and Real-Time Data:**
  - **Mapbox GL JS:** Implements both heatmap and port visualisation features.
  - **SSE and WebSocket:** For live map updates.

- **Ports Information:**
  - **Scrapy and Selenium:** For web scraping of port data.
  - **LLM:** For automated report generation based on scraped data.

- **Dashboarding and Logging:**
  - **Prometheus, Grafana, and cAdvisor:** For system monitoring and log visualisation.

## Initial Ideal File Structure for All Features

The project adopts a monorepo structure that organises both frontend and backend components alongside deployment configurations and supporting scripts. Below is the initial file structure just for an overview:

```
north-sea-watch-repo/
├── backend/                     # Django backend (API, WebSocket, SSE)
│   ├── Dockerfile               # Django + Gunicorn + Uvicorn container
│   ├── manage.py                # Django entry point
│   ├── requirements.txt         # Python dependencies
│   ├── asgi.py                  # ASGI entry point (SSE & WebSocket)
│   ├── settings.py              # Configuration file (PostGIS & SSE)
│   ├── api/                     # REST API endpoints
│   │   ├── views.py             # API logic
│   │   ├── serializers.py       # DRF serializers
│   │   ├── urls.py              # API routing
│   ├── websocket/               # WebSocket handling
│   │   ├── consumers.py         # SSE / WebSocket logic
│   │   ├── routing.py           # Django Channels routing
│   ├── ports/                   # Port data processing
│   │   ├── models.py            # Django ORM for port data
│   │   ├── scraper/             # Scrapy + Selenium spiders
│   │   │   ├── scraper.py       # Scrapy spider implementation
│   │   │   ├── selenium_driver.py # Selenium handling
│   │   ├── report_generator/    # LLM-based report generation
│   │   │   ├── llm.py           # Report generation logic
│   │   │   ├── embeddings.py    # Semantic search (FAISS, ChromaDB)
│   ├── postgis/                 # GIS data storage & queries
│   │   ├── queries.py           # PostGIS SQL queries
│   │   ├── geoprocessing.py     # Vessel trajectory analysis (ST_Buffer, ST_Intersects)
│   ├── scripts/                 # Backend tasks & automation scripts
│   │   ├── import_data.py       # Data initialisation script
│   │   ├── update_ports.py      # Port data update script
│   ├── tests/                   # Django tests
│   ├── urls.py                  # Main URL routing
├── frontend/                    # React + Mapbox GL application
│   ├── Dockerfile               # React container configuration
│   ├── package.json             # Node.js dependencies
│   ├── src/                     # React source code
│   │   ├── components/          # React components
│   │   │   ├── Map.js           # Mapbox rendering for ships & heatmap
│   │   │   ├── Ports.js         # Port pollution data visualisation
│   │   │   ├── Dashboard.js     # Monitoring & charts
│   │   ├── utils/               # Utility functions
│   │   ├── App.js               # React entry point
│   ├── public/                  # Static assets
├── monitor/                     # Prometheus, Grafana & cAdvisor configurations
│   ├── prometheus.yml           # Prometheus configuration
│   ├── grafana/                 # Grafana configuration
│   │   ├── dashboards/          # Grafana dashboard JSON files
│   │   ├── datasources/         # Grafana data source configurations
│   ├── cadvisor/                # cAdvisor monitoring configuration
│   ├── docker-compose.monitor.yml # Docker Compose for monitoring setup
├── deployment/                  # Deployment & CI/CD configurations
│   ├── docker-compose.yml       # Local development Docker Compose
│   ├── docker-compose.prod.yml  # Production deployment Docker Compose
│   ├── nginx/                   # Nginx reverse proxy configuration
│   │   ├── Dockerfile           # Nginx container configuration
│   │   ├── default.conf         # Reverse proxy configuration
│   ├── github-actions/          # GitHub Actions automation
│   │   ├── ci-cd.yml            # CI/CD workflow file
│   ├── cloud-run/               # Google Cloud Run deployment configurations
├── data/                        # Data storage (GeoJSON / MVT vector tiles)
│   ├── tiles/                   # Vector tiles (Mapbox MVT)
│   ├── geojson/                 # Static boundary data
│   ├── pollution_reports/       # Environmental & policy reports
├── scripts/                     # Scripts
│   ├── start.sh                 # One-click production deployment script
├── .github/                     # GitHub Actions CI/CD configuration
│   ├── workflows/
│   │   ├── docker-build.yml     # Docker build workflow
│   │   ├── deploy-cloud-run.yml # Cloud Run deployment workflow
│   │   ├── deploy-vm.yml        # Google VM deployment workflow
│   ├── dependabot.yml           # Dependency checking configuration             
└── README.md
```

## Frontend Architecture

```
frontend/
├── node_modules/                # Node.js dependencies
├── public/                      # Static files
│   ├── favicon.ico              # Website favicon
│   ├── index.html               # HTML entry point
│   ├── logo192.png              # Logo for PWA
│   ├── logo512.png              # Larger logo for PWA
│   ├── manifest.json            # PWA manifest file
│   └── robots.txt               # Search engine crawling rules
├── src/                         # Source code directory
│   ├── app/                     # Core application setup
│   ├── assets/                  # Static assets (images, fonts, etc.)
│   ├── components/              # Reusable React components
│   ├── config/                  # Configuration files
│   ├── features/                # Feature-based modules
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Third-party library configurations
│   ├── stores/                  # State management (e.g., Redux stores)
│   ├── styles/                  # Global styles and themes
│   ├── types/                   # TypeScript type definitions
│   ├── utils/                   # Utility functions
│   └── index.tsx                # Application entry point
├── .dockerignore                # Files to exclude from Docker builds
├── .env                         # Environment variables
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── docker-compose.prod.yml      # Production Docker configuration
├── docker-compose.yml           # Development Docker configuration
├── Dockerfile                   # Docker build instructions
├── package.json                 # Project dependencies and scripts
├── README.md                    # Project documentation
└── yarn.lock                    # Yarn dependency lock file
```

### Key Directories and Files

#### Public Directory
- `index.html`: The main HTML template
- `manifest.json`: Progressive Web App configuration
- `robots.txt`: Search engine crawling rules
- Logo files: Various sizes for different devices/contexts

#### Source Directory (src/)
1. **app/**
   - Application-wide setup
   - Root providers and configurations

2. **assets/**
   - Images, icons, and other static files
   - Organized by type (images/, icons/, etc.)

3. **components/**
   - Reusable UI components
   - Should follow atomic design principles
   - Each component should have its own directory with tests

4. **config/**
   - Environment-specific configurations
   - API endpoints
   - Feature flags

5. **features/**
   - Feature-based modules
   - Each feature contains its own components, hooks, and logic
   - Promotes code organization by business domain

6. **hooks/**
   - Custom React hooks
   - Shared logic between components
   - API integration hooks

7. **lib/**
   - Third-party library configurations
   - API clients
   - Authentication setup

8. **stores/**
   - State management
   - Redux/MobX stores
   - Global state configurations

9. **styles/**
   - Global CSS/SCSS files
   - Theme configurations
   - CSS variables and mixins

10. **types/**
    - TypeScript type definitions
    - Shared interfaces and types
    - API response types

11. **utils/**
    - Helper functions
    - Common utilities
    - Data formatters

### Development Workflow

1. **Environment Setup**
   
   Copy environment template, ignore this for now since `.env` is already predefined
   ```bash
   cp .env.example .env
   ```
   
   Install dependencies, only run this to generate new `yarn.lock` if `package.json` was updated with new dependencies
   ```bash
   yarn install
   ```

3. **Docker Development**

   Build and run with Docker
   ```bash
   docker compose build --no-cache
   ```
   ```bash
   docker compose up
   ```
   Access **http://localhost:3000/** to view live updates during development

5. **Code Organization**
   - Follow feature-based architecture
   - Keep components small and focused
   - Use TypeScript
   - Write tests for components and utilities

6. **Best Practices**
   - Use environment variables for configuration
   - Follow ESLint and Prettier rules
   - Write meaningful commit messages
   - Document any complex logic and components

### Important Notes

1. **Environment Variables**
   - All must start with `REACT_APP_`
   - Set different values for development/production
   - In theory never commit sensitive values to git, but it's ok for a school project

2. **Docker Configuration**
   - Development uses hot-reload
   - Production builds optimized bundle
   - Uses multi-stage builds for efficiency

3. **TypeScript**
   - Use strict mode
   - Define interfaces for all props
   - Avoid using `any` type

4. **State Management**
   - Use hooks for local state
   - Redux/MobX for global state
   - Consider React Query for API state

## Backend Architecture

```
backend/
├── apps/                        # Main application directory
│   ├── common/                  # Shared utilities and helpers
│   ├── config/                  # Core configuration
│   │   ├── __init__.py          # Package initializer
│   │   ├── asgi.py              # ASGI configuration
│   │   ├── settings.py          # Django settings
│   │   ├── urls.py              # Root URL configuration
│   │   ├── wsgi.py              # WSGI configuration
│   │   ├── wsgi.py              # WSGI configuration
│   ├── fixtures/                # Initial/test data (JSON/YAML)
│   ├── migrations/              # Database migrations
│   ├── north_sea_watch/         # Main app module
│   │   ├── __pycache__/         # Python cache files
│   │   ├── api/                 # API endpoints
│   │   ├── requirements/        # App-specific dependencies
│   │   ├── admin.py             # Django admin configuration
│   │   ├── apps.py              # App configuration
│   │   ├── models.py            # Database models
│   │   ├── services.py          # Services logic
│   │   ├── urls.py              # App URL patterns
│   │   ├── __init__.py          # Package initializer
│   └── templates/               # HTML templates
├── .dockerignore                # Docker ignore rules
├── .env                         # Environment variables
├── .env.example                 # Environment template
├── cloudsql-auth.json           # Google Cloud SQL credentials
├── docker-compose.prod.yml      # Production Docker configuration
├── docker-compose.yml           # Development Docker configuration
├── Dockerfile                   # Docker build instructions
├── entrypoint.sh                # Docker entrypoint script
└── manage.py                    # Django management script
```

### Key Directories and Files

#### Configuration (apps/config/)
1. **settings.py**
   - Django core settings
   - Database configuration
   - Installed apps
   - Middleware setup

2. **urls.py**
   - Root URL routing
   - API endpoints mapping
   - Admin interface URLs

3. **asgi.py/wsgi.py**
   - Application server interface
   - WebSocket support
   - Production server setup

#### Main Application (apps/north_sea_watch/)
1. **api/**
   - REST API endpoints
   - Serializers
   - ViewSets

2. **models.py**
   - Database models
   - Model relationships
   - Field definitions

3. **services.py**
   - Business logic
   - External service integration
   - Data processing

4. **admin.py**
   - Django admin interface
   - Model registration
   - Custom admin views

#### Support Files
1. **requirements/**
   - Development dependencies
   - Production dependencies
   - Optional packages

2. **fixtures/**
   - Initial data
   - Test data
   - Demo data

3. **migrations/**
   - Database schema changes
   - Data migrations
   - Migration dependencies

### Development Workflow

1. **Environment Setup**

   Copy environment template, ignore this for now since `.env` is already predefined
   ```bash
   cp .env.example .env
   ```

2. **Docker Development**
   
   Build and run with Docker
   ```bash
   docker compose build --no-cache
   ```

   ```bash
   docker compose up
   ```
   
   Create superuser (Default superuser: **Username** `appuser` **Password** `northseawatch`)
   ```bash
   docker compose exec backend /usr/local/bin/python manage.py createsuperuser
   ```

3. **Migrations**

   Create Migration file
   ```bash
   docker compose exec backend /usr/local/bin/python manage.py makemigrations north_sea_watch
   ```

   Make Migrations
   ```bash
   docker compose exec backend /usr/local/bin/python manage.py migrate north_sea_watch
   ```

   Clear all Migrations (it will clear all stored data so be careful)
   ```bash
   docker compose exec backend /usr/local/bin/python manage.py migrate north_sea_watch zero
   ```

4. **Database Operations**
   
   Export database data to a file
   ```bash
   docker compose exec backend /usr/local/bin/python manage.py dumpdata north_sea_watch > backup.json
   ```

   Import data from backup file
   ```bash
   docker compose exec backend /usr/local/bin/python manage.py loaddata backup.json
   ```
   
   Create migration files for model changes
   ```bash
   docker compose exec backend /usr/local/bin/python manage.py makemigrations north_sea_watch
   ```
   
   Apply migrations to the database
   ```bash
   docker compose exec backend /usr/local/bin/python manage.py migrate north_sea_watch
   ```

### Important Notes

1. **Environment Variables**
   - Sensitive data in .env
   - Different configs for dev/prod
   - Cloud SQL connection details

2. **Docker Configuration**
   - Uses Cloud SQL proxy
   - ASGI server (Uvicorn)
   - Volume mounts for development

3. **API Development**
   - Use Django REST framework
   - Implement viewsets
   - Version API endpoints

4. **Security**
   - Secure Cloud SQL connection
   - Environment variable protection
   - CORS configuration

### Best Practices

1. **Code Organization**
   - Keep models thin
   - All services logic in services
   - Use Django apps for modularity

2. **Database**
   - Regular migrations (not for now)
   - Backup strategy
   - Index optimization

3. **API Design**
   - RESTful principles
   - Proper status codes
   - Documentation

4. **Testing**
   - Unit tests for models
   - Integration tests for APIs
   - Use fixtures for test data

---

## ABM Simulation Implementation

The Agent-Based Model (ABM) simulation page provides an interactive experience for simulating maritime traffic and pollution policy impacts in the North Sea region.

### Architecture & Data Flow

1. **Frontend Implementation**
   - React-based interface with HTML5 Canvas for visualization rendering
   - Context API for state management (`ABMProvider` and `useABMContext`)
   - Custom Canvas rendering replaces Mesa's native visualization for web compatibility

2. **Backend Implementation**
   - Mesa framework powers the agent-based simulation logic
   - Django REST endpoints handle simulation creation and control
   - Background threads manage simulation execution independently from HTTP requests

3. **Key Components**
   - **Agents**: Ships (with various types and behaviors), Ports (with configurable policies), and pollution traces
   - **Simulation Controls**: Start/stop, step-by-step execution, speed control, and parameter adjustments
   - **Dashboard**: Real-time metrics display of environmental impacts and ship behaviors

4. **Data Flow**
   - Frontend initiates simulation with configuration parameters
   - Backend processes model steps and maintains simulation state
   - REST API transfers grid state and metrics to frontend
   - Canvas renderer visualizes current simulation state

This implementation enables policymakers and stakeholders to experiment with different maritime pollution regulations and observe potential outcomes in a controlled virtual environment.

---

## Notes

Everything is subject to change and still under development.
