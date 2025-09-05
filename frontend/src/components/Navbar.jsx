// src/components/Navbar.jsx
import { Link } from "react-router-dom";

function Navbar() {
  return (
    <nav className="bg-green-600 text-white p-4 flex justify-between items-center shadow-md">
      {/* Logo */}
      <Link to="/" className="flex items-center space-x-2">
        <img src="/assets/logo.png" alt="ChrysaLink Logo" className="h-8" />
        <span className="font-bold text-lg">ChrysaLink</span>
      </Link>

      {/* Routes */}
      <div className="space-x-6">
        <Link to="/" className="hover:text-green-200">Home</Link>
        <a href="#how-it-works" className="hover:text-green-200">How It Works</a>
        <a href="#description" className="hover:text-green-200">Description</a>
        <a href="#objectives" className="hover:text-green-200">Objectives</a>
      </div>

      {/* Auth */}
      <div className="space-x-4">
        <Link to="/login" className="hover:text-green-200">Login</Link>
        <Link
          to="/signup"
          className="bg-white text-green-600 px-3 py-1 rounded-md hover:bg-green-100"
        >
          Sign Up
        </Link>
      </div>
    </nav>
  );
}

export default Navbar;
