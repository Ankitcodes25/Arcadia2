// import "./LeaderboardHero.css";

// import leadArc from "../Assets/leadArc.png";
// import leadOne from "../Assets/lead#1.png";
// import leadTwo from "../Assets/lead#2.png";
// import leadThree from "../Assets/lead#3.png";

// function LeaderboardHero() {
//   return (
//     <section className="leaderboard-hero">
//       {/* Background atmosphere */}
//       <div className="leaderboard-hero-bg" />
//       <div className="leaderboard-hero-grid" />
//       <div className="leaderboard-hero-glow leaderboard-hero-glow-left" />
//       <div className="leaderboard-hero-glow leaderboard-hero-glow-right" />

//       {/* Floating particles */}
//       <span className="leaderboard-particle leaderboard-particle-1" />
//       <span className="leaderboard-particle leaderboard-particle-2" />
//       <span className="leaderboard-particle leaderboard-particle-3" />
//       <span className="leaderboard-particle leaderboard-particle-4" />
//       <span className="leaderboard-particle leaderboard-particle-5" />

//       {/* Left content */}
//       <div className="leaderboard-hero-content">
//         <span className="leaderboard-hero-eyebrow">
//           COMPETE • CLIMB • CONQUER
//         </span>

//         <h1>
//           Leaderboard
//           <span>.</span>
//         </h1>

//         <p className="leaderboard-hero-description">
//           Rise through the ranks, challenge the best, and make your mark
//           across the Arcadia.
//         </p>

//         <div className="leaderboard-season">
//           <div className="leaderboard-season-icon">
//             <span>01</span>
//           </div>

//           <div className="leaderboard-season-info">
//             <span className="leaderboard-season-label">
//               CURRENT SEASON
//             </span>
//             <strong>Season 01</strong>
//           </div>

//           <div className="leaderboard-season-divider" />

//           <div className="leaderboard-season-info leaderboard-season-end">
//             <span className="leaderboard-season-label">
//               STATUS
//             </span>
//             <strong>Active</strong>
//           </div>
//         </div>

//         <button
//           type="button"
//           className="leaderboard-hero-button"
//           onClick={() => {
//             document
//               .getElementById("leaderboard-rankings")
//               ?.scrollIntoView({ behavior: "smooth" });
//           }}
//         >
//           <span>View rankings</span>
//           <span className="leaderboard-button-arrow">→</span>
//         </button>
//       </div>

//       {/* Right visual */}
//       <div className="leaderboard-hero-visual" aria-hidden="true">
//         {/* Back ranking cards */}
//         <div className="leaderboard-rank-card leaderboard-rank-card-three">
//           <img src={leadThree} alt="" />
//         </div>

//         <div className="leaderboard-rank-card leaderboard-rank-card-two">
//           <img src={leadTwo} alt="" />
//         </div>

//         <div className="leaderboard-rank-card leaderboard-rank-card-one">
//           <img src={leadOne} alt="" />
//         </div>

//         {/* Arcadion */}
//         <div className="leaderboard-arcadion">
//           <div className="leaderboard-arcadion-aura" />
//           <img src={leadArc} alt="" />
//         </div>

//         {/* Decorative ring */}
//         <div className="leaderboard-orbit leaderboard-orbit-one" />
//         <div className="leaderboard-orbit leaderboard-orbit-two" />

//         {/* Small floating rank indicators */}
//         <div className="leaderboard-floating-rank leaderboard-floating-rank-one">
//           <span>#1</span>
//         </div>

//         <div className="leaderboard-floating-rank leaderboard-floating-rank-two">
//           <span>#2</span>
//         </div>

//         <div className="leaderboard-floating-rank leaderboard-floating-rank-three">
//           <span>#3</span>
//         </div>
//       </div>

//       {/* Bottom fade */}
//       <div className="leaderboard-hero-bottom-fade" />
//     </section>
//   );
// }

// export default LeaderboardHero;