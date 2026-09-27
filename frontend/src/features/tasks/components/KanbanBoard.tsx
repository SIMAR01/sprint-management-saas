import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import {
  useProjectTasksQuery,
  useCreateTaskMutation,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useTaskEventsQuery,
  useBulkDeleteTasksMutation,
  useUploadTaskAttachmentsMutation,
  useDeleteTaskAttachmentMutation,
} from "../hooks/useTaskQueries";
import { useWorkspaceQuery } from "../../projects/hooks/useProjectQueries";
import { useTaskSocketSync } from "../hooks/useTaskSocketSync";
import { Task, TaskStatus } from "../types/task.types";
import {
  Kanban,
  Plus,
  MoreVertical,
  ArrowRight,
  Clock,
  Trash2,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  X,
  AlertCircle,
  History,
  FileText,
  CheckSquare,
  Square,
  Filter,
  Paperclip,
  Image as ImageIcon,
  Video,
  ExternalLink,
  Upload,
  Eye,
  Check,
  Film,
  GripVertical,
} from "lucide-react";

const COLUMNS: { id: TaskStatus; label: string; color: string }[] = [
  { id: "todo", label: "To Do", color: "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20" },
  { id: "inprogress", label: "In Progress", color: "text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 border-brand-200 dark:border-brand-500/20" },
  { id: "underreview", label: "Review", color: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20" },
  { id: "done", label: "Done", color: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20" },
];

const isPdf = (url: string) => url.toLowerCase().endsWith(".pdf") || url.includes("/raw/upload/") || url.includes(".pdf?");

export const KanbanBoard: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  // Initialize Socket.IO sync for this specific project board
  useTaskSocketSync(projectId!);

  const { data: tasks = [], isLoading, error } = useProjectTasksQuery(projectId!);
  const { data: project } = useWorkspaceQuery(projectId!);

  const createMutation = useCreateTaskMutation(projectId!);
  const updateMutation = useUpdateTaskMutation(projectId!);
  const deleteMutation = useDeleteTaskMutation(projectId!);
  const bulkDeleteMutation = useBulkDeleteTasksMutation(projectId!);
  const uploadMutation = useUploadTaskAttachmentsMutation(projectId!);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskVideoUrl, setNewTaskVideoUrl] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [boardSuccess, setBoardSuccess] = useState<string | null>(null);

  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Bulk Mode state
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  // File input ref for create modal
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compile member list options for assignee filtering
  const members = project ? [
    { userId: project.owner, name: project.ownerName || "Owner", username: project.ownerUsername || "owner" },
    ...(project.members || [])
      .filter((m) => m.userId !== project.owner)
      .map((m) => ({ userId: m.userId, name: m.name || "Member", username: m.username || "member" }))
  ] : [];

  // Filter tasks locally based on filters selection
  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) {
      return false;
    }
    if (assigneeFilter !== "all") {
      if (assigneeFilter === "unassigned") {
        if (t.assigneeId) return false;
      } else {
        if (t.assigneeId !== assigneeFilter) {
          return false;
        }
      }
    }
    return true;
  });

  const triggerBoardError = (msg: string) => {
    setBoardError(msg);
    setTimeout(() => {
      setBoardError((prev) => (prev === msg ? null : prev));
    }, 5000);
  };

  const triggerBoardSuccess = (msg: string) => {
    setBoardSuccess(msg);
    setTimeout(() => {
      setBoardSuccess((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setPendingFiles((prev) => [...prev, ...selected]);
    }
  };

  const handleRemovePendingFile = (idx: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    const title = newTaskTitle.trim();
    const desc = newTaskDesc.trim();
    const videoUrl = newTaskVideoUrl.trim() || undefined;

    if (!title) {
      setCreateError("Task title cannot be empty");
      return;
    }
    if (title.length > 200) {
      setCreateError("Task title cannot exceed 200 characters");
      return;
    }
    if (desc.length > 2000) {
      setCreateError("Description cannot exceed 2000 characters");
      return;
    }

    try {
      let uploadedUrls: string[] = [];

      // If user selected files, upload them to Cloudinary first
      if (pendingFiles.length > 0) {
        setIsUploadingFiles(true);
        const uploadResult = await uploadMutation.mutateAsync(pendingFiles);
        if (uploadResult.files && Array.isArray(uploadResult.files)) {
          uploadedUrls = uploadResult.files.map((f) => f.secureUrl || f.url);
        } else if (uploadResult.secureUrl || uploadResult.url) {
          uploadedUrls = [uploadResult.secureUrl || uploadResult.url!];
        }
      }

      await createMutation.mutateAsync({
        title,
        description: desc || undefined,
        status: "todo",
        images: uploadedUrls,
        videoUrl: videoUrl || null,
      });

      setIsCreateOpen(false);
      setNewTaskTitle("");
      setNewTaskDesc("");
      setNewTaskVideoUrl("");
      setPendingFiles([]);
      triggerBoardSuccess("Task created successfully with attachments!");
    } catch (err: any) {
      setCreateError(err.response?.data?.message || err.message || "Failed to create task");
    } finally {
      setIsUploadingFiles(false);
    }
  };

  const handleMoveTask = (task: Task) => {
    const next = getNextStatus(task.status);
    if (!next) return;

    // Check if moving to done but no proof attached (warning / reminder)
    if (next === "done" && (!task.images || task.images.length === 0)) {
      if (!window.confirm("Moving to Done without proof attachments. Are you sure you want to proceed?")) {
        return;
      }
    }

    updateMutation.mutate(
      { taskId: task.taskId, updates: { status: next } },
      {
        onSuccess: () => {
          triggerBoardSuccess(`Task moved to ${next.toUpperCase()}`);
        },
        onError: (err: any) => {
          triggerBoardError(err.response?.data?.message || "Failed to update task status");
        },
      }
    );
  };

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceStatus = source.droppableId as TaskStatus;
    const destStatus = destination.droppableId as TaskStatus;

    if (sourceStatus === destStatus) {
      return;
    }

    const draggedTask = tasks.find((t) => t.taskId === draggableId);
    if (!draggedTask) return;

    // Warning if moving to Done without proof attachments
    if (destStatus === "done" && (!draggedTask.images || draggedTask.images.length === 0)) {
      if (!window.confirm("Moving to Done without proof attachments. Are you sure you want to proceed?")) {
        return;
      }
    }

    const destCol = COLUMNS.find((c) => c.id === destStatus);
    const destLabel = destCol ? destCol.label : destStatus.toUpperCase();

    updateMutation.mutate(
      { taskId: draggableId, updates: { status: destStatus } },
      {
        onSuccess: () => {
          triggerBoardSuccess(`Task moved to ${destLabel}`);
        },
        onError: (err: any) => {
          triggerBoardError(
            err.response?.data?.message || err.message || `Failed to move task to ${destLabel}`
          );
        },
      }
    );
  };

  const getNextStatus = (current: TaskStatus): TaskStatus | null => {
    const idx = COLUMNS.findIndex((c) => c.id === current);
    if (idx < COLUMNS.length - 1) return COLUMNS[idx + 1].id;
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Failed to load board</h3>
        <button onClick={() => navigate("/dashboard")} className="mt-4 text-brand-600 dark:text-brand-400 hover:underline">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const activeTask = selectedTaskForEdit
    ? tasks.find((t) => t.taskId === selectedTaskForEdit.taskId) || selectedTaskForEdit
    : null;

  return (
    <div className="flex flex-col h-full space-y-6 animate-fade-in">
      {/* Board Success Banner */}
      {boardSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-200 p-3.5 rounded-xl text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <span>{boardSuccess}</span>
          </div>
          <button
            onClick={() => setBoardSuccess(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Board Error Banner */}
      {boardError && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-800 dark:text-red-200 p-3.5 rounded-xl text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 dark:text-red-400 shrink-0" />
            <span>{boardError}</span>
          </div>
          <button
            onClick={() => setBoardError(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded-lg"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Workspaces</span>
          </button>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-violet-500 flex items-center justify-center shadow-md shadow-brand-500/20">
              <Kanban className="w-5 h-5 text-white" />
            </div>
            <span>{project?.name || "Task Board"}</span>
          </h2>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center justify-center gap-1.5 bg-gradient-to-tr from-brand-600 to-violet-500 hover:from-brand-500 hover:to-violet-400 active:scale-98 text-white font-semibold py-2 px-4 rounded-xl text-xs transition-all shadow-md shadow-brand-500/10 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Controls: Filters + Bulk Mode Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl glass-card border border-slate-200/90 dark:border-slate-800/80">
        {/* Left Side: Local Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            <Filter className="w-3.5 h-3.5 text-brand-500 dark:text-brand-400" />
            <span>Filters:</span>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer shadow-sm"
            >
              <option value="all">All Statuses</option>
              <option value="todo">To Do</option>
              <option value="inprogress">In Progress</option>
              <option value="underreview">Review</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Assignee Filter */}
          <div className="flex items-center gap-1">
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-brand-500 cursor-pointer shadow-sm"
            >
              <option value="all">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name} (@{m.username})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Side: Bulk Actions Mode toggles */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {isBulkMode ? (
            <div className="flex items-center gap-2 w-full justify-between md:justify-end">
              <span className="text-xs text-brand-600 dark:text-brand-400 font-semibold">
                {selectedTaskIds.length} selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedTaskIds.length === filteredTasks.length) {
                      setSelectedTaskIds([]);
                    } else {
                      setSelectedTaskIds(filteredTasks.map((t) => t.taskId));
                    }
                  }}
                  className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition-all"
                >
                  {selectedTaskIds.length === filteredTasks.length ? "Deselect All" : "Select All"}
                </button>
                <button
                  disabled={selectedTaskIds.length === 0 || bulkDeleteMutation.isPending}
                  onClick={() => setBulkConfirmOpen(true)}
                  className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-medium rounded-lg transition-all flex items-center gap-1 shadow-sm"
                >
                  {bulkDeleteMutation.isPending && <Loader2 className="w-3 animate-spin" />}
                  <span>Delete Selected</span>
                </button>
                <button
                  onClick={() => {
                    setIsBulkMode(false);
                    setSelectedTaskIds([]);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsBulkMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 font-medium rounded-lg transition-all shadow-sm"
            >
              <CheckSquare className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>Bulk Select</span>
            </button>
          )}
        </div>
      </div>

      {/* Kanban Drag & Drop Columns Grid */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
          <div className="flex gap-6 h-full min-w-max">
            {COLUMNS.map((col) => {
              const columnTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <div key={col.id} className="w-80 flex flex-col h-[calc(100vh-270px)] min-h-[420px] shrink-0">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full bg-current ${col.color.split(" ")[0]}`} />
                      {col.label}
                    </h3>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${col.color}`}>
                      {columnTasks.length}
                    </span>
                  </div>

                  {/* Task Card List Droppable */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-800 scrollbar-track-transparent rounded-2xl p-1.5 transition-colors duration-200 ${
                          snapshot.isDraggingOver
                            ? "bg-brand-500/[0.08] border-2 border-dashed border-brand-500/50"
                            : "border-2 border-transparent"
                        }`}
                      >
                        {columnTasks.map((task, index) => (
                          <Draggable
                            key={task.taskId}
                            draggableId={task.taskId}
                            index={index}
                            isDragDisabled={isBulkMode}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className={`transition-all ${
                                  dragSnapshot.isDragging
                                    ? "shadow-2xl ring-2 ring-brand-500 rounded-2xl scale-[1.02] opacity-95 cursor-grabbing z-50"
                                    : "cursor-grab active:cursor-grabbing"
                                }`}
                              >
                                <TaskCard
                                  task={task}
                                  onMove={() => handleMoveTask(task)}
                                  onDelete={() => setTaskToDelete(task)}
                                  onClick={() => setSelectedTaskForEdit(task)}
                                  isBulkMode={isBulkMode}
                                  isSelected={selectedTaskIds.includes(task.taskId)}
                                  onSelectToggle={() => {
                                    setSelectedTaskIds((prev) =>
                                      prev.includes(task.taskId)
                                        ? prev.filter((id) => id !== task.taskId)
                                        : [...prev, task.taskId]
                                    );
                                  }}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                          <div className="h-28 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800/60 flex flex-col items-center justify-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                            <span>No tasks in {col.label}</span>
                            <span className="text-[10px] text-slate-400/80 dark:text-slate-500/80 mt-0.5">Drag tasks here</span>
                          </div>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </div>
      </DragDropContext>

      {/* Create Task Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-800/80 animate-scale-in">
            <div className="px-6 py-4 bg-slate-900/50 border-b border-slate-800/80 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-400" />
                <span>Create New Task</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800/50 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {createError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-3 rounded-lg text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-[10px] ${newTaskTitle.length > 200 ? "text-red-400 font-bold" : "text-slate-500"}`}>
                    {newTaskTitle.length}/200
                  </span>
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Task title or milestone name"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider">
                    Description <span className="text-slate-600 font-normal capitalize">(Optional)</span>
                  </label>
                  <span className={`text-[10px] ${newTaskDesc.length > 2000 ? "text-red-400 font-bold" : "text-slate-500"}`}>
                    {newTaskDesc.length}/2000
                  </span>
                </div>
                <textarea
                  placeholder="Provide context, requirements, acceptance criteria..."
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              {/* Video Demonstration URL */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-brand-400" />
                  <span>Demo Video Link <span className="text-slate-600 font-normal capitalize">(Loom / YouTube / Cloudinary)</span></span>
                </label>
                <input
                  type="url"
                  placeholder="https://www.loom.com/share/... or https://youtube.com/..."
                  value={newTaskVideoUrl}
                  onChange={(e) => setNewTaskVideoUrl(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Cloudinary File Uploads (Images, PDFs, Videos) */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5 text-brand-400" />
                    <span>Upload Proofs & Documents <span className="text-slate-600 font-normal capitalize">(Cloudinary)</span></span>
                  </span>
                  <span className="text-[10px] text-slate-500">JPG, PNG, PDF, Video</span>
                </label>

                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleFileSelection}
                  accept="image/*,application/pdf,video/*"
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer p-4 rounded-xl border border-dashed border-slate-800 hover:border-brand-500/50 bg-slate-900/40 hover:bg-brand-500/[0.03] transition-all flex flex-col items-center justify-center text-center gap-1.5"
                >
                  <Upload className="w-5 h-5 text-slate-400" />
                  <p className="text-xs font-semibold text-slate-300">
                    Click to select screenshots or PDF documents
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Files are securely stored in Cloudinary
                  </p>
                </div>

                {/* Pending Selected Files List */}
                {pendingFiles.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {pendingFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-200"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {file.type.includes("pdf") ? (
                            <FileText className="w-4 h-4 text-red-400 shrink-0" />
                          ) : file.type.includes("video") ? (
                            <Film className="w-4 h-4 text-purple-400 shrink-0" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-brand-400 shrink-0" />
                          )}
                          <span className="truncate">{file.name}</span>
                          <span className="text-[10px] text-slate-500">
                            ({(file.size / 1024).toFixed(0)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePendingFile(idx)}
                          className="text-slate-500 hover:text-red-400 p-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex justify-end gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    createMutation.isPending ||
                    isUploadingFiles ||
                    !newTaskTitle.trim() ||
                    newTaskTitle.length > 200 ||
                    newTaskDesc.length > 2000
                  }
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 active:scale-98 text-white rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-brand-500/20"
                >
                  {(createMutation.isPending || isUploadingFiles) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  <span>
                    {isUploadingFiles ? "Uploading Files..." : createMutation.isPending ? "Creating..." : "Create Task"}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Delete Tasks Confirmation Modal */}
      {bulkConfirmOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-800/80">
            <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-800/80 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>Confirm Bulk Delete</span>
              </h3>
              <button
                onClick={() => setBulkConfirmOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800/50 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to delete the <span className="text-white font-bold">{selectedTaskIds.length}</span> selected tasks? This action records a soft delete.
              </p>

              <div className="flex justify-end gap-2 text-xs font-semibold pt-2">
                <button
                  type="button"
                  onClick={() => setBulkConfirmOpen(false)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkConfirmOpen(false);
                    bulkDeleteMutation.mutate(selectedTaskIds, {
                      onSuccess: () => {
                        setSelectedTaskIds([]);
                        setIsBulkMode(false);
                        triggerBoardSuccess("Selected tasks deleted successfully");
                      },
                      onError: (err: any) => {
                        triggerBoardError(err.response?.data?.message || "Failed to bulk delete tasks");
                      },
                    });
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 active:scale-98 text-white rounded-lg transition-all"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Task Confirmation Modal */}
      {taskToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-800/80">
            <div className="px-6 py-4 bg-slate-900/40 border-b border-slate-800/80 flex items-center justify-between">
              <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>Confirm Delete</span>
              </h3>
              <button
                onClick={() => setTaskToDelete(null)}
                className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800/50 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to delete <span className="text-white font-semibold">"{taskToDelete.title}"</span>?
              </p>

              <div className="flex justify-end gap-2 text-xs font-semibold pt-2">
                <button
                  type="button"
                  onClick={() => setTaskToDelete(null)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const taskId = taskToDelete.taskId;
                    setTaskToDelete(null);
                    deleteMutation.mutate(taskId, {
                      onSuccess: () => {
                        triggerBoardSuccess("Task deleted successfully");
                      },
                      onError: (err: any) => {
                        triggerBoardError(err.response?.data?.message || "Failed to delete task");
                      },
                    });
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 active:scale-98 text-white rounded-lg transition-all"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Task Details, Edit & Attachments Modal */}
      {activeTask && (
        <TaskDetailsModal
          task={activeTask}
          projectId={projectId!}
          onClose={() => setSelectedTaskForEdit(null)}
        />
      )}
    </div>
  );
};

// ─── TASK CARD COMPONENT ─────────────────────────────────────────────────────

const TaskCard: React.FC<{
  task: Task;
  onMove: () => void;
  onDelete: () => void;
  onClick: () => void;
  isBulkMode?: boolean;
  isSelected?: boolean;
  onSelectToggle?: () => void;
}> = ({ task, onMove, onDelete, onClick, isBulkMode = false, isSelected = false, onSelectToggle }) => {
  const [showMenu, setShowMenu] = useState(false);
  const imagesCount = task.images ? task.images.length : 0;
  const hasVideo = !!task.videoUrl;

  const handleCardClick = (e: React.MouseEvent) => {
    if (isBulkMode) {
      e.stopPropagation();
      if (onSelectToggle) onSelectToggle();
    } else {
      onClick();
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={`cursor-pointer glass-card p-4 rounded-2xl border transition-all relative bg-white dark:bg-slate-900/50 hover:shadow-lg ${
        isBulkMode
          ? isSelected
            ? "border-brand-500 bg-brand-50/80 dark:bg-brand-500/10 shadow-md shadow-brand-500/5"
            : "border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/40"
          : "border-slate-200/90 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/40"
      }`}
    >
      {/* Top row: Status/Time + Menu */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {!isBulkMode && (
            <GripVertical className="w-3.5 h-3.5 text-slate-400/60 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0" />
          )}
          {isBulkMode && (
            <span className="mr-1 mt-0.5 shrink-0 text-brand-600 dark:text-brand-400">
              {isSelected ? (
                <CheckSquare className="w-3.5 h-3.5" />
              ) : (
                <Square className="w-3.5 h-3.5" />
              )}
            </span>
          )}
          <Clock className="w-3 h-3" />
          <span>{new Date(task.createdAt).toLocaleDateString()}</span>
        </div>

        {!isBulkMode && (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />
                <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl py-1 z-20 animate-scale-in">
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1 leading-snug break-words">
        {task.title}
      </h4>

      {task.description && (
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      {/* Media Attachments Indicator Pills */}
      {(imagesCount > 0 || hasVideo) && (
        <div className="flex items-center gap-2 my-2.5 flex-wrap">
          {imagesCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-200 dark:border-brand-500/20">
              <Paperclip className="w-3 h-3" />
              <span>{imagesCount} {imagesCount === 1 ? 'file' : 'files'}</span>
            </span>
          )}

          {hasVideo && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-500/20">
              <Video className="w-3 h-3" />
              <span>Demo</span>
            </span>
          )}
        </div>
      )}

      {/* Bottom actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
        <div className="text-[10px] text-slate-500 truncate max-w-[200px]" title={task.assignee?.name || "Unassigned"}>
          {task.assignee?.name ? `Assignee: ${task.assignee.name}` : task.assigneeId ? `Assignee: ${task.assigneeId.substring(0, 8)}...` : 'Unassigned'}
        </div>

        {task.status !== "done" ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove();
            }}
            title="Move to next stage"
            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-500/20 text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-500/30 transition-all"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <div className="p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TASK DETAILS & EDIT MODAL (WITH ATTACHMENT MANAGER) ─────────────────────

const TaskDetailsModal: React.FC<{
  task: Task;
  projectId: string;
  onClose: () => void;
}> = ({ task, projectId, onClose }) => {
  const queryClient = useQueryClient();
  const { data: project } = useWorkspaceQuery(projectId);
  const updateMutation = useUpdateTaskMutation(projectId);
  const uploadMutation = useUploadTaskAttachmentsMutation(projectId);
  const deleteAttachmentMutation = useDeleteTaskAttachmentMutation(projectId);

  const [title, setTitle] = useState(task.title);
  const [desc, setDesc] = useState(task.description || "");
  const [status, setStatus] = useState(task.status);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId || "");
  const [videoUrl, setVideoUrl] = useState(task.videoUrl || "");

  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [previewMediaUrl, setPreviewMediaUrl] = useState<string | null>(null);

  const editFileInputRef = useRef<HTMLInputElement>(null);

  const cachedTasks = queryClient.getQueryData<Task[]>(["project-tasks", projectId]) || [];
  const currentTask = cachedTasks.find((t) => t.taskId === task.taskId) || task;
  const currentImages = currentTask.images || [];

  useEffect(() => {
    setTitle(currentTask.title);
    setDesc(currentTask.description || "");
    setStatus(currentTask.status);
    setAssigneeId(currentTask.assigneeId || "");
    setVideoUrl(currentTask.videoUrl || "");
  }, [currentTask.title, currentTask.description, currentTask.status, currentTask.assigneeId, currentTask.videoUrl]);

  const { data: events = [], isLoading: isEventsLoading } = useTaskEventsQuery(
    projectId,
    task.taskId,
    showTimeline
  );

  const handleUpdateField = (updates: any) => {
    setError(null);
    setSuccess(null);
    updateMutation.mutate(
      { taskId: task.taskId, updates },
      {
        onSuccess: () => {
          setSuccess("Updated successfully");
          setTimeout(() => setSuccess(null), 2500);
        },
        onError: (err: any) => {
          setError(err.response?.data?.message || "Failed to update task");
        },
      }
    );
  };

  const handleSaveTextChanges = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanDesc = desc.trim();
    const cleanVideoUrl = videoUrl.trim() || null;

    if (!cleanTitle) {
      setError("Title cannot be empty");
      return;
    }
    if (cleanTitle.length > 200) {
      setError("Title cannot exceed 200 characters");
      return;
    }
    if (cleanDesc.length > 2000) {
      setError("Description cannot exceed 2000 characters");
      return;
    }

    handleUpdateField({
      title: cleanTitle,
      description: cleanDesc || null,
      videoUrl: cleanVideoUrl,
    });
  };

  // Upload new attachments directly to this existing task
  const handleAddNewAttachments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    setError(null);
    setIsUploading(true);

    try {
      const uploadRes = await uploadMutation.mutateAsync(files);
      let newUrls: string[] = [];

      if (uploadRes.files && Array.isArray(uploadRes.files)) {
        newUrls = uploadRes.files.map((f) => f.secureUrl || f.url);
      } else if (uploadRes.secureUrl || uploadRes.url) {
        newUrls = [uploadRes.secureUrl || uploadRes.url!];
      }

      const updatedImages = [...currentImages, ...newUrls];
      handleUpdateField({ images: updatedImages });
      setSuccess("New attachment(s) uploaded successfully!");
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to upload attachments");
    } finally {
      setIsUploading(false);
      if (editFileInputRef.current) editFileInputRef.current.value = "";
    }
  };

  // Remove/Delete an attachment from Cloudinary and Detach from Task
  const handleRemoveAttachment = async (urlToRemove: string) => {
    if (!window.confirm("Are you sure you want to remove this attachment?")) return;
    setError(null);

    try {
      // 1. Filter out the image locally in database update
      const filtered = currentImages.filter((u) => u !== urlToRemove);
      handleUpdateField({ images: filtered });

      // 2. Extract publicId to clean up Cloudinary storage
      // Cloudinary URL structure: .../teamflow/projects/.../tasks/filename.ext
      const parts = urlToRemove.split("/upload/");
      if (parts.length > 1) {
        const pathAfterUpload = parts[1].replace(/^v\d+\//, "");
        const publicIdWithExt = pathAfterUpload;
        const publicId = publicIdWithExt.substring(0, publicIdWithExt.lastIndexOf(".")) || publicIdWithExt;

        deleteAttachmentMutation.mutate({
          publicId,
          taskId: task.taskId,
          fileUrl: urlToRemove,
        });
      }
      setSuccess("Attachment removed successfully");
    } catch (err: any) {
      setError("Failed to detach file");
    }
  };

  const getTimelineEventDescription = (ev: any) => {
    const actor = ev.actor?.name || ev.actor?.username || "Someone";
    switch (ev.eventType) {
      case "TASK_CREATED":
        return `${actor} created this task`;
      case "STATUS_CHANGED":
        return `${actor} changed status from "${ev.payload?.previousStatus}" to "${ev.payload?.newStatus}"`;
      case "ASSIGNEE_CHANGED":
        return `${actor} changed assignee to ${ev.payload?.newAssigneeId ? "a team member" : "unassigned"}`;
      case "TASK_UPDATED":
        return `${actor} updated task details / proofs`;
      case "TASK_DELETED":
        return `${actor} deleted this task`;
      default:
        return `${actor} triggered event: ${ev.eventType}`;
    }
  };

  const members = project ? [
    { userId: project.owner, name: project.ownerName || "Owner", username: project.ownerUsername || "owner" },
    ...(project.members || [])
      .filter((m) => m.userId !== project.owner)
      .map((m) => ({ userId: m.userId, name: m.name || "Member", username: m.username || "member" }))
  ] : [];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-card w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-slate-800/80 flex flex-col max-h-[92vh] animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900/50 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-brand-500/10 text-brand-300 px-2.5 py-1 rounded-lg border border-brand-500/20">
              Task Workspace Details
            </span>
            {success && (
              <span className="text-xs text-emerald-400 font-medium animate-pulse">
                {success}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              title="Audit Event History"
              className={`p-1.5 rounded-lg border transition-all ${
                showTimeline
                  ? "bg-brand-500/20 text-brand-400 border-brand-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
              }`}
            >
              <History className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800/50 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col md:flex-row gap-6">
          {/* Left panel: Fields, Description, Video Link & Attachments */}
          <form onSubmit={handleSaveTextChanges} className="flex-1 space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-200 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Title */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Title
                </label>
                <span className={`text-[10px] ${title.length > 200 ? "text-red-400 font-bold" : "text-slate-500"}`}>
                  {title.length}/200
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider">
                  Description
                </label>
                <span className={`text-[10px] ${desc.length > 2000 ? "text-red-400 font-bold" : "text-slate-500"}`}>
                  {desc.length}/2000
                </span>
              </div>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                placeholder="Details, bug reports, or sprint acceptance guidelines..."
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>

            {/* Video Demonstration URL */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-purple-400" />
                  <span>Demo Video URL</span>
                </span>
                {videoUrl && (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-brand-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>Watch Video</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://loom.com/... or https://youtube.com/..."
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Attachments & Proofs Gallery (Cloudinary) */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-brand-400" />
                  <span className="text-xs font-bold uppercase text-slate-300 tracking-wider">
                    Attachments & Proofs ({currentImages.length})
                  </span>
                </div>

                <input
                  type="file"
                  multiple
                  ref={editFileInputRef}
                  onChange={handleAddNewAttachments}
                  accept="image/*,application/pdf,video/*"
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-brand-300 text-xs font-semibold rounded-lg border border-slate-750 transition-colors disabled:opacity-50"
                >
                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  <span>Add Attachment</span>
                </button>
              </div>

              {currentImages.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-2">
                  No attachments yet. Upload screenshot proofs or PDFs to substantiate completion.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  {currentImages.map((imgUrl, i) => {
                    const isFilePdf = isPdf(imgUrl);
                    return (
                      <div
                        key={i}
                        className="relative group rounded-xl overflow-hidden border border-slate-800 bg-slate-950/70 p-2 flex flex-col items-center justify-center text-center gap-1.5"
                      >
                        {isFilePdf ? (
                          <div
                            onClick={() => window.open(imgUrl, "_blank")}
                            className="cursor-pointer flex flex-col items-center justify-center h-20 w-full hover:text-brand-300 transition-colors"
                          >
                            <FileText className="w-8 h-8 text-red-400 mb-1" />
                            <span className="text-[10px] font-bold truncate max-w-[100px]">PDF Document</span>
                          </div>
                        ) : (
                          <div
                            onClick={() => setPreviewMediaUrl(imgUrl)}
                            className="cursor-pointer relative h-20 w-full rounded-lg overflow-hidden bg-slate-900 flex items-center justify-center group-hover:opacity-90"
                          >
                            <img
                              src={imgUrl}
                              alt="Attachment proof"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Eye className="w-5 h-5 text-white" />
                            </div>
                          </div>
                        )}

                        <div className="w-full flex items-center justify-between text-[10px] text-slate-400 pt-1">
                          <a
                            href={imgUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-brand-300 truncate max-w-[70px] flex items-center gap-0.5"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleRemoveAttachment(imgUrl)}
                            className="text-slate-500 hover:text-red-400 p-0.5"
                            title="Remove file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Save Text Changes Button */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={
                  updateMutation.isPending ||
                  !title.trim() ||
                  title.length > 200 ||
                  desc.length > 2000
                }
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 active:scale-98 text-white text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-brand-500/10"
              >
                {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>

          {/* Right panel: Meta controls */}
          <div className="w-full md:w-56 space-y-5 shrink-0 border-t md:border-t-0 md:border-l border-slate-800/80 pt-5 md:pt-0 md:pl-6">
            {/* Status Selector */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const val = e.target.value as TaskStatus;
                  setStatus(val);
                  handleUpdateField({ status: val });
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="underreview">Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Assignee Selector */}
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 tracking-wider mb-1.5">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => {
                  const val = e.target.value;
                  setAssigneeId(val);
                  handleUpdateField({ assigneeId: val || null });
                }}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-brand-500 cursor-pointer"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} (@{m.username})
                  </option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="text-[10px] text-slate-500 space-y-1.5 pt-4 border-t border-slate-800/80">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                <span>Created: {new Date(currentTask.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                <span>Updated: {new Date(currentTask.updatedAt).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Event History Panel */}
        {showTimeline && (
          <div className="border-t border-slate-800 bg-slate-950/40 flex-1 overflow-y-auto max-h-[35vh] p-6 flex flex-col shrink-0">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-1.5 shrink-0">
              <History className="w-3.5 h-3.5 text-brand-400" />
              <span>Task Chronological Event History</span>
            </h4>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-4">
              {isEventsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
                </div>
              ) : events.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-600">
                  No logged events for this task.
                </div>
              ) : (
                <div className="relative border-l border-slate-800 pl-3 ml-2 space-y-3.5 py-1">
                  {events.map((ev: any) => (
                    <div key={ev.eventId || ev._id} className="relative text-xs">
                      <span className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-slate-800 border border-slate-700" />
                      <div>
                        <p className="text-slate-300 font-medium leading-relaxed">
                          {getTimelineEventDescription(ev)}
                        </p>
                        <span className="text-[9px] text-slate-500 block mt-0.5">
                          {new Date(ev.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Image / Attachment Preview Lightbox Modal */}
        {previewMediaUrl && (
          <div className="fixed inset-0 bg-black/90 z-60 flex items-center justify-center p-4">
            <div className="relative max-w-4xl max-h-[85vh] w-full flex flex-col items-center">
              <button
                onClick={() => setPreviewMediaUrl(null)}
                className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={previewMediaUrl}
                alt="Enlarged Attachment"
                className="max-h-[80vh] w-auto max-w-full rounded-2xl shadow-2xl object-contain border border-slate-800"
              />
              <div className="mt-3 flex items-center gap-3">
                <a
                  href={previewMediaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand-400 hover:underline flex items-center gap-1 bg-slate-900/90 px-3 py-1 rounded-lg border border-slate-800"
                >
                  <span>Open Full Size</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
