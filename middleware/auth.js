import jwt from "jsonwebtoken";

// const JWT_SECRET = process.env.JWT_SECRET ;
// console.log("ENV CHECK AUTH:", process.env.JWT_SECRET);

export const verifyToken = (req, res, next) => {

  const JWT_SECRET = process.env.JWT_SECRET;
  console.log("ENV CHECK AUTH:", process.env.JWT_SECRET);

  
  const authHeader = req.header("Authorization");
  console.log(JWT_SECRET, "secretkey");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Access Denied. No token provided." });
  }

  const token = authHeader.split(" ")[1]; // Extract token

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    // console.log("Decoded Token:", verified); // Debugging log

    if (!verified.roles || !Array.isArray(verified.roles)) {
      console.error("Roles are missing or invalid in the token payload");
      return res
        .status(403)
        .json({ message: "Invalid token payload: roles missing" });
    }

    req.user = {
      userName: verified.userName,
      userId: verified.userId,
      roles: verified.roles,
      role: verified.role, // Current logined role
      _id: verified._id,
    };

    next();
  } catch (error) {
    console.error("Invalid Token:", error.message);
    return res.status(403).json({ message: "Forbidden: Invalid Token" });
  }
};
