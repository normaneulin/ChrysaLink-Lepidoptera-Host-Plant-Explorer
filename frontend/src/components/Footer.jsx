// src/components/Footer.jsx
function Footer() {
  return (
    <footer className="bg-green-600 text-white p-6 mt-10">
      <div className="flex flex-col items-center space-y-2">
        <img src="/assets/logo.png" alt="Logo" className="h-8" />
        <p>© {new Date().getFullYear()} ChrysaLink. All rights reserved.</p>
        <div className="space-x-4">
          <a href="#about" className="hover:text-green-200">About</a>
          <a href="#contact" className="hover:text-green-200">Contact</a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
