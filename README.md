
# Chapter. — Book Store API

The Chapter. backend provides the REST API for the online bookstore. It handles authentication, book management, shopping cart operations, orders, seller applications, and administrative functionality.

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** JavaScript (ES Modules)
- **Database:** MongoDB Atlas
- **ODM:** Mongoose
- **Validation:** express-validator
- **Authentication:** Token-based authentication
- **Email:** Nodemailer
- **Deployment:** Render

## Features

- User registration and login
- Authentication and authorization
- Book and inventory management
- Shopping cart and wishlist APIs
- Order management
- Seller applications and approval workflow
- Role-based reader, seller, and admin permissions
- Request validation and error handling
- Welcome and password-reset email workflows

## Project Structure

```text
book-store-backend/
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── services/
├── utils/
├── server.js
├── package.json
├── .gitignore
└── README.md
```

The exact folders may differ depending on the current implementation.

## Getting Started

### 1. Clone the repository

```bash
git clone YOUR_BACKEND_REPOSITORY_URL
cd book-store-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the backend root. Use the variable names expected by your existing application.

Example:

```env
PORT=8000
NODE_ENV=development
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_secure_random_secret
CLIENT_URL=http://localhost:3000
```

Add any other variables required by your project, such as email provider credentials, password-reset configuration, or cloud file storage credentials.

Do not commit your real `.env` file.

### 4. Start the development server

If your `package.json` defines a `dev` script:

```bash
npm run dev
```

Otherwise, use the development command configured in your `package.json`.

The API should start on the configured port, commonly `8000` during local development.

## API Configuration

The frontend connects to this backend using Axios.

For local development, configure the frontend API base URL to point to your local backend. For production, use your deployed Render API URL.

Configure CORS to allow your frontend origin. Avoid allowing every origin in production unless you have a specific reason.

## Deployment — Render

1. Push this backend project to its own GitHub repository.
2. Create a new Web Service in Render and connect the backend repository.
3. Select the appropriate Node.js runtime.
4. Set the root directory to `.` if the repository contains only the backend.
5. Configure the build command, usually:

   ```bash
   npm install
   ```

6. Configure the start command to match your actual `package.json`, for example:

   ```bash
   npm start
   ```

7. Add all required production environment variables in Render.
8. Configure the deployed frontend URL in your backend CORS settings.
9. Deploy and inspect the logs.
10. Test the API and verify database connectivity.

## Security

- Keep database credentials and JWT secrets private.
- Validate incoming requests.
- Verify authentication and permissions on protected endpoints.
- Enforce seller approval and admin access in the backend, not only in the frontend.
- Never trust a role or price supplied by the client without server-side verification.
- Use HTTPS in production.
- Do not return passwords, password hashes, or private credentials in API responses.

## Project Purpose

This backend is part of the Chapter. full-stack bookstore project, built to practice REST API development, MVC architecture, database integration, authentication, authorization, validation, and deployment.
