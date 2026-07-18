import { useState } from "react";
import { initialMentors } from "../../constants";
import type { Mentor } from "../../types";
import { MentorCard } from "./MentorCard";
import { MentorDetailModal } from "./MentorDetailModal";

export function MentoringTab() {
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-6 py-8 lg:px-8">
      <div>
        <h1 className="text-[22px] font-bold tracking-tight">Mentores disponíveis</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {initialMentors.map((mentor) => (
          <MentorCard key={mentor.id} mentor={mentor} onOpen={setSelectedMentor} />
        ))}
      </div>
      {selectedMentor ? (
        <MentorDetailModal
          mentor={selectedMentor}
          onClose={() => setSelectedMentor(null)}
        />
      ) : null}
    </div>
  );
}
