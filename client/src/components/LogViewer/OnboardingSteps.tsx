import { useLogStore } from "../../stores/logStore";

interface Step {
  title: string;
  subtitle: string;
  isComplete: boolean;
}

export default function OnboardingSteps() {
  const profile = useLogStore((s) => s.profile);
  const selectedLogGroups = useLogStore((s) => s.selectedLogGroups);

  const steps: Step[] = [
    {
      title: "Select an AWS Profile",
      subtitle: "Choose which AWS credentials to use",
      isComplete: profile !== null,
    },
    {
      title: "Pick a Log Group",
      subtitle: "Select one or more log groups to query",
      isComplete: selectedLogGroups.length > 0,
    },
    {
      title: "Click Search",
      subtitle: "Or press Enter in the filter field",
      isComplete: false,
    },
  ];

  // Find the first incomplete step
  const currentIdx = steps.findIndex((s) => !s.isComplete);

  return (
    <div className="flex flex-1 items-center justify-center pt-16">
      <div className="flex flex-col gap-0 w-full max-w-[360px]">
        {steps.map((step, idx) => {
          const isDone = idx < currentIdx || (currentIdx === -1);
          const isCurrent = idx === currentIdx;

          return (
            <div key={step.title}>
              {/* Connector line (before every step except the first) */}
              {idx > 0 && (
                <div className="ml-[13px] h-3 w-0.5 bg-base-content/10" />
              )}

              {/* Step row */}
              <div
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  isCurrent
                    ? "bg-accent/[0.08] border border-accent/20"
                    : "border border-transparent"
                }`}
              >
                {/* Circle */}
                {isDone ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-content text-xs font-bold">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : isCurrent ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-accent text-accent text-xs font-bold">
                    {idx + 1}
                  </div>
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-base-content/20 text-base-content/20 text-xs font-bold">
                    {idx + 1}
                  </div>
                )}

                {/* Text */}
                <div className={isDone || isCurrent ? undefined : "opacity-40"}>
                  <div
                    className={`text-sm font-semibold ${
                      isDone ? "text-accent" : "text-base-content"
                    }`}
                  >
                    {step.title}
                  </div>
                  <div className="text-xs text-base-content/50">{step.subtitle}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
