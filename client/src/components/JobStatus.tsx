import { useEffect, useState } from "react";
import { DisconnectedError } from "../connection/client";
import { getJob } from "../connection/modernize";

export function JobStatus({ projectId, jobId }: { projectId: string; jobId: string | null }) {
  const [text, setText] = useState("No job is running.");

  useEffect(() => {
    if (!jobId) {
      setText("No job is running.");
      return;
    }
    let stop = false;
    const tick = () => {
      getJob(projectId, jobId)
        .then((job) => {
          if (stop) return;
          setText(job.error ? `${job.status}: ${job.error}` : `Job ${job.status}`);
        })
        .catch((reason: unknown) => {
          if (stop) return;
          setText(reason instanceof DisconnectedError ? "Job progress will appear after the database is connected." : "Job status could not be read.");
        });
    };
    tick();
    const timer = window.setInterval(tick, 2000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [projectId, jobId]);

  return <p className="callout" role="status" aria-live="polite">{text}</p>;
}
