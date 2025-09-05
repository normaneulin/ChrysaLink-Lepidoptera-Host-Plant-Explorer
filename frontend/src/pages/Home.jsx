// src/pages/Home.jsx
function Home() {
  return (
    <div className="text-gray-800">
      {/* Hero Image */}
      <section className="relative w-full h-[400px]">
        <img
          src="/assets/hero-image.jpg"
          alt="Hero"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <h1 className="text-white text-4xl font-bold">
            Explore Lepidoptera & Host Plants
          </h1>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="p-10 bg-green-50">
        <h2 className="text-2xl font-bold mb-4 text-green-700">How It Works</h2>
        <p>
          ChrysaLink helps researchers and enthusiasts explore the connections
          between Lepidoptera and their host plants, providing a structured
          database and interactive visualization.
        </p>
      </section>

      {/* Description */}
      <section id="description" className="p-10">
        <h2 className="text-2xl font-bold mb-4 text-green-700">Description</h2>
        <p>
          Our platform serves as a comprehensive tool for cataloging
          Lepidoptera-host plant interactions. With an intuitive interface, it
          supports scientific exploration and environmental education.
        </p>
      </section>

      {/* Objectives */}
      <section id="objectives" className="p-10 bg-green-50">
        <h2 className="text-2xl font-bold mb-4 text-green-700">Objectives</h2>
        <ul className="list-disc pl-6">
          <li>Provide accessible data on Lepidoptera and host plants</li>
          <li>Support ecological and biodiversity studies</li>
          <li>Encourage citizen science participation</li>
        </ul>
      </section>
    </div>
  );
}

export default Home;
