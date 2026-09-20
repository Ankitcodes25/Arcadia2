import arcadionImage from "../../../assets/ArcadionCTA.png";

function ArcadionCTA() {
  const handleExplore = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <section className="arcadion-cta" id="arcadion-cta">
      {/* Background */}
      <div className="arcadion-cta-bg" />

      {/* Atmospheric glow */}
      <div className="arcadion-cta-glow" />

      {/* Main content */}
      <div className="arcadion-cta-content">
        <span className="arcadion-cta-eyebrow">
          THE WORLD OF
        </span>

        <h2>ARCADIA</h2>

        <h3>
         Your world. Your games. Your journey
        </h3>

        <p className="arcadion-cta-description">
          Step into Arcadia — where every game is a new story,
          every challenge a new chance, and every victory
          brings you closer to something greater.
        </p>

        <button
          type="button"
          className="arcadion-explore-button"
          onClick={handleExplore}
        >
          <span>EXPLORE NOW</span>
          <span className="arcadion-explore-arrow">→</span>
        </button>

        {/* Feature links */}
        <div className="arcadion-cta-features">
          <div className="arcadion-feature">
            <span className="arcadion-feature-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect x="3" y="6" width="18" height="12" rx="3" />
                <path d="M7 12h4M9 10v4" />
                <circle cx="16" cy="11" r="1" />
                <circle cx="18" cy="13" r="1" />
              </svg>
            </span>

            <span>
              EXPLORE
              <br />
              GAMES
            </span>
          </div>

          <div className="arcadion-feature">
            <span className="arcadion-feature-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M8 4l4 4-4 4" />
                <path d="M16 20l-4-4 4-4" />
                <path d="M4 8h8M12 16h8" />
              </svg>
            </span>

            <span>
              TAKE ON
              <br />
              CHALLENGES
            </span>
          </div>

          <div className="arcadion-feature">
            <span className="arcadion-feature-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M6 20h12" />
                <path d="M8 20v-7h3v7" />
                <path d="M13 20V9h3v11" />
                <path d="M3 20V16h3v4" />
                <path d="M4 12l5-5 3 3 7-7" />
                <path d="M15 3h4v4" />
              </svg>
            </span>

            <span>
              CLIMB THE
              <br />
              LEADERBOARD
            </span>
          </div>
        </div>
      </div>

      {/* Arcadion */}
      <div className="arcadion-cta-character">
        <div className="arcadion-character-aura" />

        <img
          src={arcadionImage}
          alt="Arcadion"
        />
      </div>

      {/* Bottom fade */}
      <div className="arcadion-cta-fade" />
    </section>
  );
}

export default ArcadionCTA;