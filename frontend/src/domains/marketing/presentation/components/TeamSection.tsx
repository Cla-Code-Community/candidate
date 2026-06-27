import { useEffect, useState } from 'react';
import { Autoplay, Pagination } from 'swiper/modules';
import { Swiper, SwiperSlide } from 'swiper/react';

import { Github } from 'lucide-react';
import 'swiper/css';
import 'swiper/css/pagination';

interface Contributor {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: string;
}

const INITIAL_TEAM: Contributor[] = [
  {
    id: 1,
    login: "Benevanio",
    avatar_url: "https://github.com/Benevanio.png",
    html_url: "https://github.com/Benevanio",
    contributions: 188,
    type: "User"
  },
  {
    id: 104951475,
    login: "PedroLucas1337",
    avatar_url: "https://github.com/PedroLucas1337.png",
    html_url: "https://github.com/PedroLucas1337",
    contributions: 0,
    type: "User"
  },
  {
    id: 110640572,
    login: "thalitat",
    avatar_url: "https://avatars.githubusercontent.com/u/110640572?v=4",
    html_url: "https://github.com/thalitat",
    contributions: 0,
    type: "User"
  },
  {
    id: 999999998,
    login: "jeremiassnts",
    avatar_url: "https://github.com/jeremiassnts.png",
    html_url: "https://github.com/jeremiassnts",
    contributions: 0,
    type: "User"
  }
];

export default function TeamSection() {
  const [contributors, setContributors] = useState<Contributor[]>(INITIAL_TEAM);

  const OWNER = "Benevanio";
  const REPO = "Jobs_Scraper_Global";

  useEffect(() => {
    fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contributors`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;

        const realUsers = (data as Contributor[])
          .filter(user => user.type === 'User')
          .map(user => {
            const login = user.login.toLowerCase();

            if (login === "pedrolucas1337") {
              return {
                ...user,
                avatar_url: "https://github.com/PedroLucas1337.png"
              };
            }

            if (login === "thalitat") {
              return {
                ...user,
                avatar_url: "https://avatars.githubusercontent.com/u/110640572?v=4"
              };
            }

            if (login === "jeremiassnts") {
              return {
                ...user,
                avatar_url: "https://github.com/jeremiassnts.png"
              };
            }

            return user;
          });

        const fixedMembers: Contributor[] = [
          {
            id: 104951475,
            login: "PedroLucas1337",
            avatar_url: "https://github.com/PedroLucas1337.png",
            html_url: "https://github.com/PedroLucas1337",
            contributions: 0,
            type: "User"
          },
          {
            id: 110640572,
            login: "thalitat",
            avatar_url: "https://avatars.githubusercontent.com/u/110640572?v=4",
            html_url: "https://github.com/thalitat",
            contributions: 0,
            type: "User"
          },
          {
            id: 999999998,
            login: "jeremiassnts",
            avatar_url: "https://github.com/jeremiassnts.png",
            html_url: "https://github.com/jeremiassnts",
            contributions: 0,
            type: "User"
          }
        ];

        fixedMembers.forEach(member => {
          const exists = realUsers.some(
            user => user.login.toLowerCase() === member.login.toLowerCase()
          );

          if (!exists) {
            realUsers.push(member);
          }
        });

        const merged = [...INITIAL_TEAM, ...realUsers];

        const unique = merged.filter(
          (user, index, self) =>
            index === self.findIndex(
              u => u.login.toLowerCase() === user.login.toLowerCase()
            )
        );

        setContributors(unique);
      })
      .catch((err) => {
        console.warn(
          "GitHub API offline ou limitada. Mantendo lista local:",
          err.message
        );
      });
  }, []);

  return (
    <section
      id="time"
      className="flex flex-col text-center justify-center items-center py-16 px-4 w-full min-h-[400px]"
    >
      <div className="max-w-6xl w-full">
        <h2 className="text-3xl font-bold mb-2 text-gray-800 dark:text-white">
          Nosso{" "}
          <span className="bg-gradient-to-r from-blue-600 to-violet-500 bg-clip-text text-transparent">
            Time
          </span>{" "}
          de Contribuidores
        </h2>

        <div className="text-gray-500 dark:text-gray-400 mb-10 text-sm sm:text-base">
          Conheça as mentes brilhantes por trás do{" "}
          <span className="font-bold text-gray-800 dark:text-white inline-block sm:inline">
            <span className="text-blue-500 font-bold">&lt;</span>
            Cand<span className="text-amber-500 font-bold">!</span>Date
            <span className="text-purple-500 font-bold">!</span>
            <span className="text-blue-500 font-bold">&gt;</span>
          </span>
        </div>

        <div className="w-full block min-h-[300px] slider-container">
          <Swiper
            modules={[Pagination, Autoplay]}
            spaceBetween={24}
            slidesPerView={1}
            loop={contributors.length > 1}
            speed={5000}
            pagination={{ clickable: true }}
            autoplay={{
              delay: 0,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
            breakpoints={{
              480: { slidesPerView: 2 },
              768: { slidesPerView: 3 },
              1024: { slidesPerView: 4 },
            }}
            className="pb-12 h-full w-full"
          >
            {contributors.map((user) => (
              <SwiperSlide key={user.id} className="h-full inline-block">
                <div className="flex flex-col items-center p-6 border border-gray-100 dark:border-zinc-800/80 rounded-2xl text-center bg-white dark:bg-zinc-900/40 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300 min-h-[260px] h-full justify-between">
                  
                  <div className="flex flex-col items-center w-full">
                    <img
                      src={user.avatar_url}
                      alt={user.login}
                      className="w-24 h-24 rounded-full mb-4 border-2 border-violet-500/60 shadow-sm object-cover"
                    />

                    <h4 className="font-semibold text-lg text-gray-900 dark:text-zinc-100 mb-1 truncate w-full">
                      {user.login}
                    </h4>

                    <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 mb-4">
                      {user.login.toLowerCase() === "benevanio"
                        ? "Founder & Backend Dev"
                        : user.login.toLowerCase() === "pedrolucas1337"
                        ? "QA"
                        : user.login.toLowerCase() === "thalitat"
                        ? "UX/UI Designer"
                        : user.login.toLowerCase() === "jeremiassnts"
                        ? "Engenheiro de Software Senior"
                        : `${user.contributions} ${user.contributions === 1 ? 'commit' : 'commits'}`}
                    </p>
                  </div>

                  <a
                    href={user.html_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:opacity-90 text-white flex items-center justify-center text-sm font-medium rounded-lg transition-all duration-200 gap-2 shadow-sm"
                  >
                    Ver Perfil
                    <Github className="h-4 w-4" />
                  </a>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>

      <style>{`
        .slider-container .swiper-wrapper {
          transition-timing-function: linear !important;
        }
        .slider-container .swiper-pagination-bullet-active {
          background: #4f46e5 !important;
        }
      `}</style>
    </section>
  );
}