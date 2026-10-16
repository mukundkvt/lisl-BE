import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'

dotenv.config()

const checkAuthUser = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
  
    if (!token) {
      return res.status(401).json({ status: "failed", message: "Unauthorized" });
    }
  
    try {
      const {mobileNumber} = jwt.verify(token, process.env.JWT_SECRET_KEY);
      // Attach all extracted fields to req.user
      req.user = {mobileNumber};
      
  
      next(); // ✅ Proceed to next middleware
    } catch (error) {
      return res.status(401).json({ message: 'Session expired' });
    }
  };



const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Unauthorized: User role not found' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    }
    next();
  };
};

export { checkAuthUser, requireRole };