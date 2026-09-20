import Footer from "../../components/Footer";
import { games } from "../../constants/gameData";
import HeroSection from "./Sections/HeroSection";
import PopularGames from "./Sections/PopularGames";
//import AllGames from "./Sections/AllGames";
import ContinuePlaying from "./Sections/ContinuePlaying";
import DailyChallenge from "./Sections/DailyChallenge";
import Arcadion from "./Sections/Arcadion";
import LeaderboardHome from "./Sections/LeaderboardHome";
import TimeArcadionBanner from "./Sections/TimeArcadionBanner";
import ChallengeArcadion from "./Sections/ChallengeArcadion";
import ArcadionCTA from "./Sections/ArcadionCTA";

function LandingPage() {
  return (
    <div className="app">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />
      <div className="background-glow glow-three" />

      <main>
        <HeroSection games={games} />
        <PopularGames games={games} />
        {/* <AllGames games={games} /> */}
        <ContinuePlaying />
        <TimeArcadionBanner />
        <DailyChallenge games={games} />
        <LeaderboardHome />
        <Arcadion />
        <ChallengeArcadion games={games} />
        <ArcadionCTA />
      </main>

      <Footer />
    </div>
  );
}

export default LandingPage;
