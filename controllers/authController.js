const crypto = require("crypto");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const User = require("./../models/userModel");
const catchAsync = require("./../utils/catchAsync");
const AppError = require("./../utils/appError");
// const sendEmail = require('./../utils/email');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  // Remove password from output
  user.password = undefined;
  user.active = undefined;
  user.role = undefined;

  res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user,
    },
  });
};

const verfiyEmail = catchAsync(async (user) => {
  // 1) Get user based on POSTed email
  if (!user) {
    return next(new AppError("There is no user with email address.", 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createVerifyEmailToken();
  await user.save({ validateBeforeSave: false });


  // 3) Send it to user's email
  // const resetURL = `${req.protocol}://${req.get(
  //   "host"
  // )}/api/v1/users/verfiyEmail/${resetToken}`;

  // const message = `enter this link to verify yuor email: ${resetURL}.\nIf you didn't create any email ignore this email!`;

  //   try {
  //     await sendEmail({
  //       email: user.email,
  //       subject: "Your password reset token (valid for 10 min)",
  //       message,
  //     });

  //     res.status(200).json({
  //       status: "success",
  //       message: "Token sent to email!",
  //     });
  //   } catch (err) {
  //     user.passwordResetToken = undefined;
  //     user.passwordResetExpires = undefined;
  //     await user.save({ validateBeforeSave: false });

  //     return next(
  //       new AppError("There was an error sending the email. Try again later!"),
  //       500
  //     );
  //   }
});

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    photo: req.body.photo,
    active: false,
  });

  verfiyEmail(newUser);
  res.status(200).json({
    status: "success",
    message: "Please check your email to verify your account",
  });
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1) Check if email and password exist
  if (!email || !password) {
    return next(new AppError("Please provide email and password!", 400));
  }
  // 2) Check if user exists && password is correct
  const user = await User.findOne({ email }).select("+password");

  // 3) check the user exsist or not and password correct or not
  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401));
  }

  // 4) check if the email is verifyed or not
  if (user.verifyEmailToken) {
    return next(new AppError("Please verify your email first", 401));
  }

  // 5) Check for "trustedDevice" cookie
  const trustedDeviceId = req.cookies["trustedDevice"];
  if (trustedDeviceId) {
    const isTrustedDevice = user.trustedDevices.find(
      (device) =>
        device.deviceId === trustedDeviceId && device.expiresAt > Date.now()
    );

    if (isTrustedDevice) {
      // Directly log in the user without 2FA
      createSendToken(user, 200, res);
      return;
    }
  }

  // 6) send 2FA token
  const Auth2FA = user.create2FAToken();
  await user.save({ validateBeforeSave: false });

  const token2FAUserID = user._id;
  const cookieOptions = {
    expires: new Date(Date.now() + 10 * 60 * 1000),
    httpOnly: true,
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("2fa", token2FAUserID, cookieOptions);

  // 7) If everything ok, send 2FA token to the email
  res.status(200).json({
    status: "success",
    token2FAUserID,
    message: "Logging in... Please check your email for the 2FA token.",
  });
});

exports.verify2FA = catchAsync(async (req, res, next) => {
  const userId = req.body.userId || req.cookies["2fa"];
  const { twoFactorCode, saveDevice } = req.body;

  if (!userId || !twoFactorCode) {
    return next(new AppError("Please provide user ID and 2FA code!", 400));
  }

  console.log(userId, twoFactorCode);
  const user = await User.findById(userId);
  console.log(user);

  if (!user || !user.twoFactorAuthToken) {
    return next(new AppError("Invalid request. Please try again.", 400));
  }

  const hashedCode = crypto
    .createHash("sha256")
    .update(twoFactorCode)
    .digest("hex");

  if (
    hashedCode !== user.twoFactorAuthToken ||
    user.twoFactorAuthExpires < Date.now()
  ) {
    return next(new AppError("Invalid or expired 2FA code.", 400));
  }

  // If the code is valid, clear the 2FA data and log the user in
  user.twoFactorAuthToken = undefined;
  user.twoFactorAuthExpires = undefined;

  if (saveDevice) {
    const deviceId = crypto.randomBytes(32).toString("hex");
    const expiresIn = 30 * 24 * 60 * 60 * 1000; // 30 days

    user.trustedDevices.push({
      deviceId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiresIn),
    });

    // Set cookie with device token
    res.cookie("trustedDevice", deviceId, {
      expires: new Date(Date.now() + expiresIn),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }

  await user.save({ validateBeforeSave: false });

  res.clearCookie("2fa");
  createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check of it's there
  let token;
  if (
    (req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")) ||
    req.cookies.jwt ||
    req.headers.authorization?.split(" ")[1]
  ) {
    token = req.headers.authorization.split(" ")[1] || req.cookies.jwt;
  }

  if (!token) {
    return next(new AppError("Authentication required. Please log in.", 401));
  }

  // 2) Verification token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        401
      )
    );
  }

  // 4) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password! Please log in again.", 401)
    );
  }

  // 3) If 2FA verification was required, ensure it was completed (otherwise, this middleware won't be called)
  if (!currentUser.twoFactorAuthToken) {
    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    return next(); // 2FA is complete or not required, proceed
  }

  return next(
    new AppError("2FA verification required to access this resource.", 401)
  );
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403)
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("There is no user with email address.", 404));
  }

  // 2) Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    "host"
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

  res.status(200).json({
    status: "success",
    message: "Token sent to email!",
  });
  //   try {
  //     await sendEmail({
  //       email: user.email,
  //       subject: "Your password reset token (valid for 10 min)",
  //       message,
  //     });

  //     res.status(200).json({
  //       status: "success",
  //       message: "Token sent to email!",
  //     });
  //   } catch (err) {
  //     user.passwordResetToken = undefined;
  //     user.passwordResetExpires = undefined;
  //     await user.save({ validateBeforeSave: false });

  //     return next(
  //       new AppError("There was an error sending the email. Try again later!"),
  //       500
  //     );
  //   }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Update changedPasswordAt property for the user
  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.getVerify = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    verifyEmailToken: hashedToken,
  });

  // 2) If token has not expired, and there is user, set the new password
  if (!user) {
    return next(new AppError("User not found...", 400));
  }
  user.active = true;
  user.verifyEmailToken = undefined;
  await user.save({ validateBeforeSave: false });

  // 4) Log the user in, send JWT
  createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.findById(req.user.id).select("+password");

  // 2) Check if POSTed current password is correct
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError("Your current password is wrong.", 401));
  }

  // 3) If so, update password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will NOT work as intended!

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});
