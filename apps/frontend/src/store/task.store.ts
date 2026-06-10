import { create } from "zustand";

export type TaskItem = {
  id: string;
  title: string;
  assignedTo: string;
  runningHours: number;
  limitHours: number;
  status: "Pending" | "Active" | "Completed";
  priority: "Low" | "Medium" | "High" | "Critical";
  machineName: string;
  groupId: string;
};

type TaskState = {
  tasks: TaskItem[];
  addTask: (task: Omit<TaskItem, "id">) => void;
};

export const useTaskStore = create<TaskState>((set) => ({
  tasks: [
    {
      id: "TSK-001",
      title: "Cooling Tower WF1-U3 vibration calibration",
      assignedTo: "A. Rahman",
      runningHours: 285.4,
      limitHours: 300,
      status: "Active",
      priority: "High",
      machineName: "Cooling Water System WF1U3",
      groupId: "cooling-water-system"
    },
    {
      id: "TSK-002",
      title: "Boiler-3 safety valve testing",
      assignedTo: "N. Putri",
      runningHours: 420.1,
      limitHours: 500,
      status: "Pending",
      priority: "Critical",
      machineName: "Boiler Plant Boiler 3",
      groupId: "boiler-plant"
    },
    {
      id: "TSK-003",
      title: "Compressed Air ALE-30 oil replacement",
      assignedTo: "D. Kurnia",
      runningHours: 720.5,
      limitHours: 1000,
      status: "Active",
      priority: "Medium",
      machineName: "Compressed Air ALE-30",
      groupId: "compressed-air"
    },
    {
      id: "TSK-004",
      title: "Chiller Trane CGAM-40 sensor calibration",
      assignedTo: "H. Wijaya",
      runningHours: 120.2,
      limitHours: 150,
      status: "Completed",
      priority: "Low",
      machineName: "Chiller Trane CGAM-40",
      groupId: "chiller-system"
    }
  ],
  addTask: (newTask) =>
    set((state) => {
      const nextId = `TSK-${String(state.tasks.length + 1).padStart(3, "0")}`;
      return {
        tasks: [...state.tasks, { ...newTask, id: nextId }]
      };
    })
}));
