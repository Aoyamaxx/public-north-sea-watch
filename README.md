# North Sea Watch

North Sea Watch is a comprehensive digital platform designed to monitor, visualize, and analyze maritime emissions and environmental challenges in the North Sea region. The platform serves as a scientific tool for stakeholders, policymakers, and researchers to understand the environmental impact of maritime activities, particularly focusing on scrubber water discharge from ships and related marine pollution.

## Project Overview

The North Sea Watch platform addresses critical environmental concerns in maritime shipping through a multifaceted approach that combines real-time data visualization, policy analysis, and predictive modeling. The system integrates Automatic Identification System (AIS) vessel tracking data with comprehensive vessel characteristic databases to calculate and visualize theoretical scrubber water discharge rates across different operational modes.

The platform's primary focus lies in providing transparent, scientifically-grounded information about the environmental impact of scrubber-equipped vessels operating in North Sea waters. By combining quantitative emission calculations with qualitative policy insights, North Sea Watch facilitates informed decision-making regarding maritime environmental regulations and port management strategies.

## Technical Architecture

### Core Technology Stack

The platform employs a modern, containerized architecture built on industry-standard technologies optimized for scalability and maintainability. The backend infrastructure utilizes Django as the primary web framework, complemented by Django REST Framework for API endpoints. The system leverages PostgreSQL databases for both operational data storage and AIS data management, with sophisticated database routing to handle multiple data sources efficiently.

The frontend interface is developed using React with TypeScript, providing a responsive user experience across desktop and mobile devices. The mapping functionality incorporates Mapbox GL JS for high-performance geographic visualization, including dynamic heatmaps and real-time vessel tracking capabilities. The user interface implements modern responsive design principles to ensure optimal functionality across various device form factors.

### Database Architecture

The platform utilizes a dual-database architecture to separate operational data from external AIS datasets. The primary database stores application-specific content including port descriptions, user tracking data, and calculated emission rates. A secondary database contains extensive AIS tracking data and vessel characteristics sourced from the International Council on Clean Transportation (ICCT) and other maritime databases.

Database routing mechanisms ensure that queries are automatically directed to the appropriate data source, while connection pooling optimizes performance for high-volume data operations. The system maintains referential integrity through carefully designed foreign key relationships and implements automated data validation processes.

### Containerization and Deployment

The entire application ecosystem operates within Docker containers, facilitating consistent deployment across development, testing, and production environments. The containerization strategy includes separate services for the Django backend, React frontend, and Cloud SQL proxy connections, with Docker Compose orchestrating multi-container deployments.

Production deployment targets Google Cloud Run, providing automatic scaling and load balancing capabilities. The deployment pipeline incorporates GitHub Actions for continuous integration and delivery, with automated builds triggered by repository changes. Environment-specific configurations are managed through secure environment variables and service account authentication.

## Core Functionality

### Emission Calculation Engine

The platform's centerpiece is a sophisticated emission calculation engine that computes theoretical scrubber water discharge rates for maritime vessels. The calculation methodology considers vessel-specific parameters including deadweight tonnage (DWT), ship type classification, and operational mode characteristics.

The engine implements scientifically-validated formulas based on vessel displacement calculations, incorporating block coefficients specific to different ship types. Cargo vessels utilize a block coefficient of 0.625, while tanker vessels employ a coefficient of 0.825, reflecting their distinct hull designs and displacement characteristics.

Discharge rate calculations differentiate between four operational modes: berth operations, anchoring, maneuvering, and cruising. Each mode employs different power consumption profiles for auxiliary engines (AE) and boiler operations (BO), with multipliers applied based on scrubber technology type. Open-loop scrubbers utilize a discharge multiplier of 45 kg/kWh, while closed-loop systems employ a significantly reduced rate of 0.1 kg/kWh.

### Interactive Mapping Interface

The mapping component provides comprehensive visualization of maritime traffic patterns and emission hotspots throughout the North Sea region. The interface displays real-time vessel positions overlaid with calculated discharge rates, enabling users to identify areas of concentrated environmental impact.

Heatmap visualizations aggregate emission data across temporal and spatial dimensions, revealing patterns in shipping traffic and pollution distribution. Port-specific information panels provide detailed insights into local policies, infrastructure capabilities, and operational statistics relevant to environmental management.

The mapping system implements advanced clustering algorithms to manage the display of thousands of vessel positions efficiently, while maintaining responsive interaction capabilities. Users can filter data by vessel type, scrubber technology, and temporal ranges to focus on specific analytical scenarios.

### Agent-Based Modeling Simulation

The platform incorporates a sophisticated agent-based modeling (ABM) system that simulates maritime traffic scenarios and policy impact assessments. Built on the Mesa framework, the simulation environment models individual vessels as autonomous agents with realistic behavioral characteristics and environmental constraints.

The simulation engine enables policymakers to experiment with different regulatory scenarios, including emission control areas, port access restrictions, and technology mandates. Each simulation run generates quantitative metrics on pollution reduction potential, economic impacts, and traffic pattern modifications resulting from policy interventions.

Simulation parameters can be adjusted in real-time, allowing for interactive exploration of policy alternatives. The system maintains detailed logs of agent behaviors and environmental outcomes, facilitating comprehensive analysis of intervention effectiveness.

### Port Information Management

The platform maintains extensive databases of port-specific information, including policy frameworks, infrastructure specifications, and operational capabilities. Port data encompasses regulatory status regarding scrubber discharge, waste reception facilities, and alternative fuel availability.

Content management capabilities allow authorized users to update port information through rich text editors, ensuring that policy updates and infrastructure changes are accurately reflected in the system. The information architecture supports multiple content categories including environmental policies, operational statistics, and future development plans.

## Development Environment Setup

The development environment utilizes Docker Compose to orchestrate all required services, ensuring consistency across different development setups. The configuration includes automatic hot-reloading for both frontend and backend components, facilitating rapid development iterations.

To establish the development environment, ensure Docker is installed and operational on your system. Clone the repository from the official GitHub location and navigate to either the frontend or backend directory depending on your development focus. Execute `docker compose build --no-cache` followed by `docker compose up` to initialize all services.

The backend service becomes accessible at `http://localhost:8000/` for the main Django application, with the administrative interface available at `http://localhost:8000/admin` and API endpoints at `http://localhost:8000/api/v1`. The frontend interface loads at `http://localhost:3000/` with full hot-reloading capabilities.

Database operations require containerized Django management commands. Create database migrations using `docker compose exec backend /usr/local/bin/python manage.py makemigrations north_sea_watch` and apply them with `docker compose exec backend /usr/local/bin/python manage.py migrate north_sea_watch`.

## Version Control and Collaboration

The project implements a structured Git workflow based on trunk-based development principles with feature branch isolation. The main branch serves as the production-ready codebase, protected against direct modifications and requiring pull request reviews for all changes.

Feature development occurs in dedicated branches following the naming convention `feature/description` or `bugfix/description`. All branches must originate from the current main branch to ensure compatibility and must pass automated testing before merge approval.

The project adheres to semantic versioning (SemVer) for release management, with version tags applied to significant milestones. Major version increments indicate breaking changes or substantial feature additions, minor versions represent backward-compatible enhancements, and patch versions address bug fixes and minor improvements.

## Project Structure

### Backend Organization

The Django backend follows a modular application structure within the `backend/apps/` directory. The `config/` module contains core Django settings, URL routing, and WSGI/ASGI configurations. The primary `north_sea_watch/` application manages core models, API endpoints, and business logic.

Specialized modules include `abm/` for agent-based modeling functionality, `discharge_calculation/` for emission calculation utilities, and `common/` for shared components. The structure facilitates clear separation of concerns while maintaining cohesive integration between modules.

Static files and templates are organized in dedicated directories, with database migrations tracked in version-controlled migration files. The application supports multiple database configurations through sophisticated routing mechanisms that direct queries to appropriate data sources.

### Frontend Architecture

The React frontend implements a feature-based organizational structure within `frontend/src/`. The `app/` directory contains core application setup and routing logic, while `features/` organizes functionality into discrete modules including mapping, home page, privacy management, and ABM simulation interfaces.

Supporting directories include `components/` for reusable UI elements, `hooks/` for custom React hooks, `stores/` for state management, and `utils/` for helper functions. The TypeScript configuration ensures type safety throughout the application, with custom type definitions maintained in the `types/` directory.

The build system incorporates modern web development practices including code splitting, asset optimization, and progressive web application features. Environment-specific configurations enable seamless transitions between development and production deployments.

### Documentation and Deployment

Comprehensive documentation resides in the `docs/` directory, including detailed deployment guides for Google Cloud Run, Raspberry Pi installations, and Cloudflare integration. The documentation covers both manual deployment procedures and automated CI/CD pipeline configurations.

Deployment scripts in the `scripts/` directory automate common operational tasks, while GitHub Actions workflows in `.github/workflows/` manage continuous integration and deployment processes. The configuration supports multiple deployment targets including cloud platforms and edge computing environments.

## Environmental Impact and Scientific Validation

The emission calculation methodologies implemented in North Sea Watch are grounded in peer-reviewed scientific research and industry standards. The platform incorporates data from the International Council on Clean Transportation (ICCT) and other authoritative sources to ensure accuracy and reliability of environmental impact assessments.

Discharge rate calculations account for the complex relationship between vessel characteristics, operational modes, and scrubber technology types. The system recognizes that environmental impact varies significantly based on factors including ship size, route patterns, and technology implementation, providing nuanced analysis rather than simplified generalizations.

The platform serves as a tool for evidence-based policy development, enabling stakeholders to quantify the environmental benefits of different regulatory approaches. By providing transparent access to calculation methodologies and underlying data sources, North Sea Watch supports informed public discourse on maritime environmental protection.

## Future Development and Scalability

The platform architecture supports extensibility through modular design patterns and well-defined API interfaces. Future enhancements may include integration with additional data sources, expansion to other maritime regions, and incorporation of emerging environmental monitoring technologies.

The containerized deployment strategy facilitates horizontal scaling to accommodate increased user loads and data volumes. The database architecture supports partitioning and replication strategies for high-availability deployments, while the API design enables integration with external systems and data feeds.

Research collaboration opportunities exist for academic institutions and environmental organizations interested in maritime pollution studies. The platform's open architecture and comprehensive API enable third-party developers to build complementary tools and analyses while maintaining data consistency and scientific rigor.
