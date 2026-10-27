"""
Shared CrewAI runner.

Each use case describes its crew as a list of CrewStep (one agent + one task).
`run_crew` executes them sequentially (each task sees the previous outputs)
and reports progress through a StepTracker so the UI can show it live.
"""
from dataclasses import dataclass
from typing import List

from app.services.progress import StepTracker


@dataclass
class CrewStep:
    name: str          # shown in the UI, e.g. "Lead Analyzer"
    role: str
    goal: str
    backstory: str
    description: str   # the task prompt
    expected_output: str


GROUNDING_RULES = (
    "Rules: Use only facts from the input, the research findings and the knowledge base. "
    "If something is unknown, say 'unknown'. Never invent names, numbers or companies."
)


def run_crew(steps: List[CrewStep], tracker: StepTracker) -> List[str]:
    """Run the crew and return each task's raw output, in order."""
    from crewai import Agent, Crew, Process, Task
    from app.core.llm import get_crew_llm

    llm = get_crew_llm(temperature=0.4)
    agents, tasks = [], []
    for step in steps:
        agent = Agent(
            role=step.role,
            goal=step.goal,
            backstory=f"{step.backstory}\n{GROUNDING_RULES}",
            llm=llm,
            verbose=False,
            allow_delegation=False,
            max_iter=3,
        )
        agents.append(agent)
        tasks.append(Task(description=step.description, expected_output=step.expected_output, agent=agent))

    outputs: List[str] = []
    tracker.start(steps[0].name)

    def on_task_done(task_output):
        index = len(outputs)
        outputs.append(str(getattr(task_output, "raw", task_output)))
        tracker.finish(steps[index].name, outputs[-1])
        if index + 1 < len(steps):
            tracker.start(steps[index + 1].name)

    crew = Crew(agents=agents, tasks=tasks, process=Process.sequential, verbose=False, task_callback=on_task_done)
    result = crew.kickoff()

    # Fallback in case the callback didn't fire for some task
    if len(outputs) < len(steps):
        for task in tasks[len(outputs):]:
            raw = getattr(getattr(task, "output", None), "raw", None) or ""
            outputs.append(raw)
        outputs[-1] = outputs[-1] or str(getattr(result, "raw", result))
        for step, out in zip(steps, outputs):
            tracker.finish(step.name, out)
    return outputs
