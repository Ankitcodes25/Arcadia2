import Footer from "../../components/Footer";
import { useAuth } from "../../auth/AuthContext";
import { games } from "../../constants/gameData";
import HeroSection from "./Sections/HeroSection";
import PopularGames from "./Sections/PopularGames";
//import AllGames from "./Sections/AllGames";
import ContinuePlaying from "./Sections/ContinuePlaying";
import type { GameHistoryEntry } from "./Sections/continuePlayingState.js";
import DailyChallenge from "./Sections/DailyChallenge";
import Arcadion from "./Sections/Arcadion";
import LeaderboardHome from "./Sections/LeaderboardHome";
import TimeArcadionBanner from "./Sections/TimeArcadionBanner";
import ChallengeArcadion from "./Sections/ChallengeArcadion";
import ArcadionCTA from "./Sections/ArcadionCTA";

// No persistent per-user game-progress source exists yet. Passing an explicit
// empty history keeps the section hidden until a real source is connected.
const AVAILABLE_GAME_HISTORY: readonly GameHistoryEntry[] = [];

function LandingPage() {
  const { user, isAuthenticated, isLoading } = useAuth();

  return (
    <div className="app">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />
      <div className="background-glow glow-three" />

      <main>
        <HeroSection games={games} />
        <PopularGames games={games} />
        {/* <AllGames games={games} /> */}
        {!isLoading && isAuthenticated && (
          <ContinuePlaying
            isLoading={isLoading}
            isAuthenticated={isAuthenticated}
            userId={user?.id ?? null}
            gameHistory={AVAILABLE_GAME_HISTORY}
            gameCatalog={games}
          />
        )}
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
