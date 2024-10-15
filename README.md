# Auth-Form

Auth-Form is a comprehensive API designed for a web application. Built using Node.js, Express, and MongoDB, this API facilitates user authentication. It ensures secure user interactions through JWT-based authentication and robust data validation.

## Features

- User authentication (Sign-up, Login)
- JWT-based authorization
- Secure API routes with data validation

## Technologies Used

- **Node.js**: Backend server
- **Express.js**: Web framework
- **MongoDB**: NoSQL database for storing user and apartment data
- **Mongoose**: ODM for MongoDB
- **JWT (JSON Web Token)**: For secure authentication
- **Bcrypt.js**: Password hashing
- **Nodemailer**: Email sending service for user notifications
- **Validator**: For validating and sanitizing inputs

## Installation

1. Clone the repository:

```bash
git clone https://github.com/youssefelzedy90/Auth-Form.git
cd Auth-Form
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory and add the following environment variables:

```
NODE_ENV=development
PORT=3000
DATABASE=mongodb+srv://youssefelzedy90:<PASSWORD>@cluster0-pwikv.mongodb.net/natours?retryWrites=true
DATABASE_LOCAL=mongodb://localhost:27017/Airbnb
DATABASE_PASSWORD=your_mongodb_password

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=90d
JWT_COOKIE_EXPIRES_IN=90
```

4. Replace `<PASSWORD>` and other placeholders with actual values.

## Scripts

- **Start the server (development mode)**:

  ```bash
  npm start
  ```

- **Start the server (production mode)**:

  ```bash
  npm run start:prod
  ```

- **Debug mode**:

  ```bash
  npm run debug
  ```

## API Endpoints

### User Routes
   - POST /api/v1/users/signup
      - Create a new user account.

   - POST /api/v1/users/login
      - Login and obtain a JWT token.

   - POST /api/v1/users/forgotPassword
      - Initiate password reset process.

   - PATCH /api/v1/users/resetPassword/:token
      - Reset password using a token.

   - PATCH /api/v1/users/verifyEmail/:token
      - Verify email using a token.

   - PATCH /api/v1/users/updateMyPassword
      - Update the current user's password.

   - GET /api/v1/users/me
      - Get the current user's details.

   - PATCH /api/v1/users/updateMe
      - Update the current user's details.

   - DELETE /api/v1/users/deleteMe
      - Deactivate the current user's account.

   - GET /api/v1/users
      - Get a list of all users (admin only).

   - POST /api/v1/users
      - Create a new user (admin only).

   - GET /api/v1/users/:id
      - Get details of a specific user by ID (admin only).

   - PATCH /api/v1/users/:id
      - Update a specific user by ID (admin only).

   - DELETE /api/v1/users/:id
      - Delete a specific user by ID (admin only).

## Project Structure

```
├── controllers/
│   ├── authController.js
│   ├── handlerFactory.js
│   ├── userController.js
│   └── errorController.js
├── models/
│   └── userModel.js
├── routes/
│   └── userRoutes.js
├── utils/
│   ├── catchAsync.js
│   └── appError.js
├── app.js
├── server.js
└── config.env
```

## Database

- **MongoDB Atlas** is used for the production database, and **MongoDB Local** is used for development.
- **Mongoose** is used to manage database connections and schema.

## Security

- **JWT** is used for user authentication. Each user must provide a valid token to access protected routes.
- Passwords are hashed using **bcrypt**.


## License

This project is licensed under the MIT License.

---

### Author

**Youssef Elzedy**
