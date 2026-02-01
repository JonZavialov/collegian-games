import { Github } from "lucide-react";

const DisclaimerFooter = () => {
  const DEV_1 = { name: "Jon Zavialov", url: "https://jonzav.me" };
  const DEV_2 = { name: "Rohan Badami", url: "https://github.com/RohanBadami" };

  return (
    <footer className="mt-16 w-full border-t border-slate-200 py-8 text-center font-sans">
      <div className="flex flex-col items-center gap-6">
        <div className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs text-slate-500 shadow-sm transition-all hover:border-blue-200 hover:shadow-md">
          <Github
            size={12}
            className="text-slate-400 transition-colors group-hover:text-black"
          />
          <span>
            Built by{" "}
            <a
              href={DEV_1.url}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-slate-700 hover:text-blue-600 hover:underline"
            >
              {DEV_1.name}
            </a>{" "}
            &{" "}
            <a
              href={DEV_2.url}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-slate-700 hover:text-blue-600 hover:underline"
            >
              {DEV_2.name}
            </a>
          </span>
        </div>

        <div className="max-w-md px-4 text-[10px] leading-relaxed text-slate-400 uppercase tracking-wide">
          <p>
            The Daily Collegian is an independent, student-run newspaper.
            <br className="hidden sm:block" />
            Game results are for entertainment purposes only.
          </p>
          <p className="mt-2">© {new Date().getFullYear()} The Daily Collegian.</p>
          <p className="mt-2">
            Player statistics sourced from CollegeFootballData.com.
            Player images from ESPN.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default DisclaimerFooter;
