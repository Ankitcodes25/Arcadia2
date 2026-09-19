import { useEffect, useState, type MouseEvent } from "react";
import { navigateTo } from "../../../lib/navigation";
import "../Landingpage.css";

import Morning from "../../../assets/Morning.webp";
import Afternoon from "../../../assets/Afternoon.webp";
import Dusk from "../../../assets/Dusk.webp";
import Night from "../../../assets/Night.webp";

type TimePeriod = "morning" | "afternoon" | "dusk" | "night";

type BannerContent = {
  period: TimePeriod;
  eyebrow: string;
  lines: string[];
  button: string;
  image: string;
};

const bannerContent: Record<TimePeriod, BannerContent> = {
  morning: {
    period: "morning",
    eyebrow: "GOOD MORNING, PLAYER",
    lines: [
      "You're up early.",
      "Nice. Arcadia saved something for you.",
    ],
    button: "Take a look",
    image: Morning,
  },

  afternoon: {
    period: "afternoon",
    eyebrow: "GOOD AFTERNOON, PLAYER",
    lines: [
      "Need a little escape?",
      "We've got you covered.",
    ],
    button: "Take a break",
    image: Afternoon,
  },

  dusk: {
    period: "dusk",
    eyebrow: "GOOD EVENING, PLAYER",
    lines: [
      "The sky is changing.",
      "Maybe it's time for another world.",
    ],
    button: "Step inside",
    image: Dusk,
  },

  night: {
    period: "night",
    eyebrow: "GOOD NIGHT, PLAYER",
    lines: [
      "It's late.",
      "You should probably sleep.",
      "But...",
    ],
    button: "Play something chill",
    image: Night,
  },
};

function getTimePeriod(): TimePeriod {
  const now = new Date();

  const hour = now.getHours();
  const minute = now.getMinutes();

  const time = hour * 60 + minute;

  // 04:00 – 10:00
  if (time >= 240 && time <= 600) {
    return "morning";
  }

  // 10:01 – 15:59
  if (time >= 601 && time <= 959) {
    return "afternoon";
  }

  // 16:00 – 20:00
  if (time >= 960 && time <= 1200) {
    return "dusk";
  }

  // 20:01 – 03:59
  return "night";
}

function TimeArcadionBanner() {
  const [period, setPeriod] = useState<TimePeriod>(() => getTimePeriod());

  useEffect(() => {
    const updatePeriod = () => {
      setPeriod(getTimePeriod());
    };

    updatePeriod();

    const interval = window.setInterval(updatePeriod, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const content = bannerContent[period];

  const handleButtonClick = (
    event: MouseEvent<HTMLButtonElement>
  ) => {
    navigateTo("/games", event);
  };

  return (
    <section
      className={`time-arcadion-banner time-arcadion-banner-${content.period}`}
      aria-label="Arcadia time based banner"
    >
      {/* Banner image + natural floating sparks */}
      <div className="time-arcadion-banner-image">
        <img
          src={content.image}
          alt=""
          aria-hidden="true"
        />

        <div
          className="arcadion-spark-field"
          aria-hidden="true"
        >
          <span className="spark spark-1" />
          <span className="spark spark-2" />
          <span className="spark spark-3" />
          <span className="spark spark-4" />
          <span className="spark spark-5" />
          <span className="spark spark-6" />
          <span className="spark spark-7" />
          <span className="spark spark-8" />
          <span className="spark spark-9" />
  <span className="spark spark-10" />
  <span className="spark spark-11" />
  <span className="spark spark-12" />
  <span className="spark spark-13" />
  <span className="spark spark-14" />
  <span className="spark spark-15" />
  <span className="spark spark-16" />
  <span className="spark spark-17" />
  <span className="spark spark-18" />
  <span className="spark spark-19" />
  <span className="spark spark-20" />
  <span className="spark spark-21" />
  <span className="spark spark-22" />
  <span className="spark spark-23" />
  <span className="spark spark-24" />
        </div>
      </div>

      {/* Dark cinematic overlay */}
      <div className="time-arcadion-banner-overlay" />

      {/* Text content */}
      <div className="time-arcadion-banner-content">
        <span className="time-arcadion-banner-eyebrow">
          {content.eyebrow}
        </span>

        <h2>
          {content.lines.map((line, index) => (
            <span key={line}>
              {line}

              {index < content.lines.length - 1 && (
                <br />
              )}
            </span>
          ))}
        </h2>

        <button
          type="button"
          className="time-arcadion-banner-button"
          onClick={handleButtonClick}
        >
          <span>{content.button}</span>

          <span className="time-arcadion-banner-arrow">
            →
          </span>
        </button>
      </div>
    </section>
  );
}

export default TimeArcadionBanner;