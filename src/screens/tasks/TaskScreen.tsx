import React, { useState, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, StatusBar, TextInput, useWindowDimensions,
  Modal, Alert, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, Shadow, IconBox } from '../../design-system/tokens';
import { ProgressBar } from '../../design-system/components/Card';
import { Badge, statusToVariant } from '../../design-system/components/Badge';
import { mockTasks, mockEmployees } from '../../data/mockData';
import {
  fetchTasks,
  createTask,
  deleteTask,
  startTaskTimerApi,
  pauseTaskTimerApi,
  pauseAllTimersApi,
  updateTaskStatusApi,
  endTaskTimerApi,
  normalizeTask,
  Task,
  fetchAllTasks,
  fetchTaskStatisticsCounts,
  fetchTaskDetails,
  updateTaskStatusPatch,
} from '../../services/taskService';
import { fetchProfile } from '../../services/authService';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type Status = 'todo' | 'in-progress' | 'completed' | 'paused';
type ViewMode = 'list' | 'grid' | 'table' | 'calendar';

const STAT_CARDS: {
  key: string; label: string;
  icon: IoniconName; iconBg: string; iconColor: string;
}[] = [
    { key: 'total', label: 'TOTAL', icon: 'list-outline', iconBg: '#EAF2FF', iconColor: '#2B7FFF' },
    { key: 'in-progress', label: 'IN PROGRESS', icon: 'play-outline', iconBg: '#FFF5E6', iconColor: '#FE9A00' },
    { key: 'completed', label: 'DONE', icon: 'checkmark', iconBg: '#E6FAEE', iconColor: '#00C950' },
    { key: 'overdue', label: 'OVERDUE', icon: 'alert-circle-outline', iconBg: '#FFF0E5', iconColor: '#FF6D07' },
  ];

const PRIORITY_OPTIONS = ['All', 'High', 'Medium', 'Low'];
const STATUS_OPTIONS = ['All', 'To Do', 'In Progress', 'Completed'];
const PROJECT_OPTIONS = ['All Projects', 'HRMS Mobile App', 'MMNext Platform'];

const PROJECT_IDS: Record<string, string> = {
  'HRMS Mobile App': '60d0feb25311236168a109d9',
  'MMNext Platform': '60d0feb25311236168a109da',
};

const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'success'> = {
  high: 'danger', medium: 'warning', low: 'success',
};

const PRIORITY_BADGE: Record<string, { bg: string; text: string }> = {
  high: { bg: '#FDEDE3', text: '#FF7312' },
  medium: { bg: '#FCF2E3', text: '#FE9A00' },
  low: { bg: '#E5FAEE', text: '#00C950' },
};

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  completed: { bg: '#E3F7EB', text: '#04CA52' },
  'in-progress': { bg: '#E6EFFC', text: '#3E8AFF' },
  todo: { bg: '#F4F4F5', text: '#52525C' },
  paused: { bg: '#FCF2E3', text: '#FE9A00' },
};

const TABLE_COLS = [
  { key: 'sl', label: 'SL NO', w: 60 },
  { key: 'details', label: 'TASK DETAILS', w: 200 },
  { key: 'priority', label: 'PRIORITY', w: 100 },
  { key: 'team', label: 'TEAM', w: 110 },
  { key: 'timeline', label: 'TIMELINE', w: 160 },
  { key: 'status', label: 'STATUS', w: 120 },
  { key: 'time', label: 'TIME SPENT', w: 130 },
  { key: 'actions', label: 'ACTIONS', w: 200 },
];

function formatTimeSpent(ts: any, timeSpentSeconds?: number) {
  if (timeSpentSeconds !== undefined && timeSpentSeconds > 0) {
    const hours = Math.floor(timeSpentSeconds / 3600);
    const minutes = Math.floor((timeSpentSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  if (!ts) return '—';
  if (ts.days > 0) return `${ts.days}d ${ts.hours}h`;
  if (ts.hours > 0) return `${ts.hours}h ${ts.minutes}m`;
  if (ts.minutes > 0) return `${ts.minutes}m`;
  return '—';
}

// ── View Modal ───────────────────────────────────────────────
function ViewModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const stat = STATUS_BADGE[task.status] ?? STATUS_BADGE.todo;
  const pri = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.low;
  const ts = task.timeSpent || { days: 0, hours: 0, minutes: 0 };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={mo.overlay} activeOpacity={1} onPress={onClose}>
        <View style={mo.sheet} onStartShouldSetResponder={() => true}>
          <View style={mo.sheetHeader}>
            <Text style={mo.sheetTitle}>Task Details</Text>
            <TouchableOpacity onPress={onClose} style={mo.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.gray600} />
            </TouchableOpacity>
          </View>

          <Text style={mo.label}>PROJECT</Text>
          <Text style={mo.value}>{task.project || 'General Project'}</Text>

          <Text style={mo.label}>TASK TITLE</Text>
          <Text style={[mo.value, { fontWeight: '700', fontSize: 15, color: Colors.gray900 }]}>{task.title}</Text>

          <View style={mo.row}>
            <View style={mo.half}>
              <Text style={mo.label}>PRIORITY</Text>
              <View style={[mo.pill, { backgroundColor: pri.bg }]}>
                <Text style={[mo.pillTxt, { color: pri.text }]}>{task.priority.toUpperCase()}</Text>
              </View>
            </View>
            <View style={mo.half}>
              <Text style={mo.label}>STATUS</Text>
              <View style={[mo.pill, { backgroundColor: stat.bg }]}>
                <Text style={[mo.pillTxt, { color: stat.text }]}>
                  {task.status === 'in-progress' ? 'IN PROGRESS' : task.status.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>

          <View style={mo.row}>
            <View style={mo.half}>
              <Text style={mo.label}>START DATE</Text>
              <Text style={mo.value}>{task.startDate || 'N/A'}</Text>
            </View>
            <View style={mo.half}>
              <Text style={mo.label}>DUE DATE</Text>
              <Text style={mo.value}>{task.dueDate || 'N/A'}</Text>
            </View>
          </View>

          <Text style={mo.label}>TIME SPENT</Text>
          <Text style={mo.value}>
            {formatTimeSpent(task.timeSpent, task.timeSpentSeconds)}
          </Text>

          <Text style={mo.label}>TEAM ASSIGNEES</Text>
          <View style={mo.avatarRow}>
            {(task.team ?? []).map((m: any, i: number) => (
              <View key={i} style={[mo.avatar, { backgroundColor: m.color || Colors.primary }]}>
                <Text style={mo.avatarTxt}>{m.initials || '??'}</Text>
              </View>
            ))}
            {(task.team ?? []).length === 0 && <Text style={mo.value}>No assignees</Text>}
          </View>

          <TouchableOpacity style={mo.doneBtn} onPress={onClose}>
            <Text style={mo.doneTxt}>Close</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Edit Modal ───────────────────────────────────────────────
function EditModal({ task, onSave, onClose }: {
  task: Task;
  onSave: (updated: Task) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState(task.status);

  const PRIS = ['high', 'medium', 'low'];
  const STATS: Status[] = ['todo', 'in-progress', 'completed', 'paused'];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={mo.overlay}>
        <View style={mo.sheet}>
          <View style={mo.sheetHeader}>
            <Text style={mo.sheetTitle}>Edit Task</Text>
            <TouchableOpacity onPress={onClose} style={mo.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.gray600} />
            </TouchableOpacity>
          </View>

          <Text style={mo.label}>TASK TITLE</Text>
          <TextInput
            style={mo.input}
            value={title}
            onChangeText={setTitle}
            placeholderTextColor={'#A4A4AD'}
          />

          <Text style={mo.label}>PRIORITY</Text>
          <View style={mo.optRow}>
            {PRIS.map(p => {
              const cfg = PRIORITY_BADGE[p];
              const active = priority === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[mo.optBtn, active && { backgroundColor: cfg.bg, borderColor: cfg.text }]}
                  onPress={() => setPriority(p)}
                >
                  <Text style={[mo.optTxt, active && { color: cfg.text, fontWeight: '700' }]}>
                    {p.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={mo.label}>STATUS</Text>
          <View style={mo.optRow}>
            {STATS.map(st => {
              const cfg = STATUS_BADGE[st];
              const active = status === st;
              const lbl = st === 'in-progress' ? 'IN PROGRESS' : st.toUpperCase();
              return (
                <TouchableOpacity
                  key={st}
                  style={[mo.optBtn, active && { backgroundColor: cfg.bg, borderColor: cfg.text }]}
                  onPress={() => setStatus(st)}
                >
                  <Text style={[mo.optTxt, active && { color: cfg.text, fontWeight: '700' }]}>{lbl}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={mo.btnRow}>
            <TouchableOpacity style={mo.cancelBtn} onPress={onClose}>
              <Text style={mo.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={mo.saveBtn}
              onPress={() => onSave({ ...task, title: title.trim() || task.title, priority, status })}
            >
              <Text style={mo.saveTxt}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const mo = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: Colors.gray900 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 9, fontWeight: '700', color: '#A4A4AD', letterSpacing: 0.8, marginTop: 4 },
  value: { fontSize: 13, color: Colors.gray700, marginTop: 2 },
  row: { flexDirection: 'row', gap: 16 },
  half: { flex: 1, gap: 4 },
  pill: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginTop: 4 },
  pillTxt: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  avatarRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 10, fontWeight: '700', color: Colors.white },
  doneBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  doneTxt: { fontSize: 14, fontWeight: '700', color: Colors.white },
  input: { borderWidth: 1, borderColor: '#E4E4E7', borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: Colors.gray900, backgroundColor: '#F9FAFB', },
  optRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optBtn: { borderWidth: 1, borderColor: '#E4E4E7', borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.gray50 },
  optTxt: { fontSize: 10, fontWeight: '600', color: Colors.gray600 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#E4E4E7', borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: Colors.gray600 },
  saveBtn: { flex: 2, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 12, alignItems: 'center' },
  saveTxt: { fontSize: 14, fontWeight: '700', color: Colors.white },
});

// ── TableRow with action buttons ─────────────────────────────

function TableRow({ task, index, onView, onEdit, onDelete, onStatusChange }: {
  task: Task;
  index: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: Status) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const pri = PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.low;
  const stat = STATUS_BADGE[task.status] ?? STATUS_BADGE.todo;
  const ts = task.timeSpent || { days: 0, hours: 0, minutes: 0 };

  const canPlay = task.status === 'todo' || task.status === 'paused';
  const canPause = task.status === 'in-progress';
  const canStop = task.status === 'in-progress' || task.status === 'paused';
  const tid = task._id || task.projectId;

  return (
    <View
      style={[tr.row, hovered && tr.rowHover, index % 2 === 1 && tr.rowAlt]}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={() => setHovered(false)}
    >
      <View style={[tr.cell, { width: TABLE_COLS[0].w }]}>
        <Text style={tr.sl}>{String(index + 1).padStart(2, '0')}</Text>
      </View>

      <View style={[tr.cell, { width: TABLE_COLS[1].w }]}>
        <Text style={tr.project}>{(task.project || 'General').toUpperCase()}</Text>
        <Text style={tr.title} numberOfLines={2}>{task.title}</Text>
      </View>

      <View style={[tr.cell, { width: TABLE_COLS[2].w }]}>
        <View style={[tr.pill, { backgroundColor: pri.bg }]}>
          <Text style={[tr.pillText, { color: pri.text }]}>{task.priority.toUpperCase()}</Text>
        </View>
      </View>

      <View style={[tr.cell, { width: TABLE_COLS[3].w }]}>
        <View style={tr.avatarRow}>
          {(task.team ?? []).slice(0, 3).map((m: any, i: number) => (
            <View key={i} style={[tr.avatar, { backgroundColor: m.color || Colors.primary, marginLeft: i > 0 ? -8 : 0, zIndex: 10 - i }]}>
              <Text style={tr.avatarText}>{m.initials || '??'}</Text>
            </View>
          ))}
          {(task.team?.length ?? 0) > 3 && (
            <View style={[tr.avatar, { backgroundColor: Colors.gray300, marginLeft: -8, zIndex: 0 }]}>
              <Text style={tr.avatarText}>+{task.team!.length - 3}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[tr.cell, { width: TABLE_COLS[4].w }]}>
        <View style={tr.timelineBox}>
          <View style={tr.timelineRow}>
            <View style={[tr.timelineDot, { backgroundColor: Colors.primary }]} />
            <Text style={tr.timelineDate}>{task.startDate || 'N/A'}</Text>
          </View>
          <View style={tr.timelineLine} />
          <View style={tr.timelineRow}>
            <View style={[tr.timelineDot, { backgroundColor: Colors.danger }]} />
            <Text style={tr.timelineDate}>{task.dueDate || 'N/A'}</Text>
          </View>
        </View>
      </View>

      <View style={[tr.cell, { width: TABLE_COLS[5].w }]}>
        <View style={[tr.pill, { backgroundColor: stat.bg }]}>
          <Text style={[tr.pillText, { color: stat.text }]}>
            {task.status === 'in-progress' ? 'IN PROGRESS' : task.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={[tr.cell, { width: TABLE_COLS[6].w }]}>
        {ts.days > 0 || ts.hours > 0 || ts.minutes > 0 ? (
          <View style={tr.timeSpentBox}>
            {ts.days > 0 && (
              <View style={tr.timeUnit}>
                <Text style={tr.timeVal}>{ts.days}</Text>
                <Text style={tr.timeLabel}>Days</Text>
              </View>
            )}
            {ts.hours > 0 && (
              <View style={tr.timeUnit}>
                <Text style={tr.timeVal}>{ts.hours}</Text>
                <Text style={tr.timeLabel}>Hrs</Text>
              </View>
            )}
            {ts.minutes > 0 && (
              <View style={tr.timeUnit}>
                <Text style={tr.timeVal}>{ts.minutes}</Text>
                <Text style={tr.timeLabel}>Min</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={tr.timeNone}>—</Text>
        )}
      </View>

      <View style={[tr.cell, { width: TABLE_COLS[7].w }]}>
        <View style={tr.actionsRow}>
          <TouchableOpacity style={[tr.actionBtn, { backgroundColor: '#E6EFFC' }]} onPress={onView}>
            <Ionicons name="eye-outline" size={14} color="#3E8AFF" />
          </TouchableOpacity>

          {canPlay && (
            <TouchableOpacity style={[tr.actionBtn, { backgroundColor: '#F5F3FF' }]} onPress={() => onStatusChange('in-progress')}>
              <Ionicons name="play-outline" size={13} color="#9136FC" />
            </TouchableOpacity>
          )}

          {canPause && (
            <TouchableOpacity style={[tr.actionBtn, { backgroundColor: '#FEF9C3' }]} onPress={() => onStatusChange('paused')}>
              <Ionicons name="pause-outline" size={13} color="#CA8A04" />
            </TouchableOpacity>
          )}

          {canStop && (
            <TouchableOpacity style={[tr.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => onStatusChange('completed')}>
              <Ionicons name="stop-outline" size={13} color="#DC2626" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[tr.actionBtn, { backgroundColor: '#E3F7EB' }]} onPress={onEdit}>
            <Ionicons name="pencil-outline" size={14} color={'#04CA52'} />
          </TouchableOpacity>

          <TouchableOpacity style={[tr.actionBtn, { backgroundColor: '#FDEDE3' }]} onPress={onDelete}>
            <Ionicons name="trash-outline" size={14} color={'#FF7312'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const TOTAL_W = TABLE_COLS.reduce((s, c) => s + c.w, 0);

function TaskTable({ tasks: initialTasks, onView, onEdit, onDelete, onStatusChange }: {
  tasks: Task[];
  onView: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: Status) => void;
}) {
  return (
    <View style={tbl.card}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ width: TOTAL_W }}>
          <View style={tbl.header}>
            {TABLE_COLS.map(col => (
              <View key={col.key} style={[tbl.hCell, { width: col.w }]}>
                <Text style={tbl.hText}>{col.label}</Text>
              </View>
            ))}
          </View>
          {initialTasks.map((task, i) => (
            <TableRow
              key={task._id || task.projectId || i}
              task={task}
              index={i}
              onView={() => onView(task)}
              onEdit={() => onEdit(task)}
              onDelete={() => onDelete(task._id)}
              onStatusChange={(status) => onStatusChange(task._id, status)}
            />
          ))}
          {initialTasks.length === 0 && (
            <View style={tbl.empty}>
              <Ionicons name="layers-outline" size={32} color={Colors.gray300} />
              <Text style={tbl.emptyText}>No tasks found</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const tbl = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing[4], ...Shadow.md },
  header: { flexDirection: 'row', backgroundColor: Colors.gray50, borderBottomWidth: 1, borderBottomColor: Colors.gray200, paddingVertical: 12, paddingHorizontal: 4 },
  hCell: { paddingHorizontal: 12, justifyContent: 'center' },
  hText: { fontSize: 10, fontWeight: '700', color: Colors.gray500, letterSpacing: 0.8 },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { fontSize: Typography.fontSize.sm, color: Colors.gray400 },
});

const tr = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: Colors.gray100, alignItems: 'center' },
  rowAlt: { backgroundColor: Colors.gray50 + '80' },
  rowHover: { backgroundColor: Colors.overlayLight },
  cell: { paddingHorizontal: 12, justifyContent: 'center' },
  sl: { fontSize: 12, fontWeight: '700', color: Colors.gray400 },
  project: { fontSize: 9, fontWeight: '700', color: Colors.primary, letterSpacing: 0.6, marginBottom: 3 },
  title: { fontSize: 12, fontWeight: '700', color: Colors.gray900, lineHeight: 17 },
  pill: { borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  avatarRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.white },
  avatarText: { fontSize: 9, fontWeight: '700', color: Colors.white },
  timelineBox: { gap: 4 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timelineDot: { width: 7, height: 7, borderRadius: 4 },
  timelineLine: { width: 1, height: 10, backgroundColor: Colors.gray300, marginLeft: 3 },
  timelineDate: { fontSize: 11, color: Colors.gray600, fontWeight: '500' },
  timeSpentBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  timeUnit: { alignItems: 'center', gap: 1 },
  timeVal: { fontSize: 13, fontWeight: '700', color: Colors.gray900 },
  timeLabel: { fontSize: 9, fontWeight: '600', color: Colors.gray400, letterSpacing: 0.3 },
  timeNone: { fontSize: 14, color: Colors.gray300, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', gap: 5, alignItems: 'center', flexWrap: 'nowrap' },
  actionBtn: { width: 28, height: 28, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
});

// ── Dropdown ────────────────────────────────────────────────
function Dropdown({
  value, options, open, onToggle, onSelect, alignRight,
}: {
  value: string; options: string[]; open: boolean;
  onToggle: () => void; onSelect: (o: string) => void; alignRight?: boolean;
}) {
  return (
    <View style={dd.wrapper}>
      <TouchableOpacity style={dd.btn} onPress={onToggle} activeOpacity={0.75}>
        <Text style={dd.btnText} numberOfLines={1}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color="#A4A4AD" />
      </TouchableOpacity>
      {open && (
        <View style={[dd.menu, alignRight && dd.menuRight]}>
          {options.map(o => (
            <TouchableOpacity key={o} style={dd.item} onPress={() => onSelect(o)} activeOpacity={0.7}>
              <Text style={[dd.itemText, value === o && dd.itemActive]}>{o}</Text>
              {value === o && <Ionicons name="checkmark" size={13} color={Colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const dd = StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 20 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F9FAFB', borderRadius: Radius.md,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: '#A4A4AD',
    minWidth: 95,
  },
  btnText: { fontSize: Typography.fontSize.xs, color: '#A4A4AD', fontWeight: '500', flex: 1 },
  menu: {
    position: 'absolute', top: 38, left: 0,
    minWidth: 140, backgroundColor: Colors.white,
    borderRadius: Radius.md, borderWidth: 1, borderColor: '#E4E4E7',
    zIndex: 9999, elevation: 20,
    ...Shadow.md,
  },
  menuRight: { left: 'auto' as any, right: 0 },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  itemText: { fontSize: Typography.fontSize.sm, color: Colors.gray700 },
  itemActive: { color: Colors.primary, fontWeight: '700' },
});

// ── Task Card (list mode) ────────────────────────────────────
function TaskCard({ task, onPress, onView, onEdit, onDelete, onStatusChange }: {
  task: Task;
  onPress: () => void;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: Status) => void;
}) {
  const isOverdue = task.status !== 'completed' && task.dueDate && new Date(task.dueDate) < new Date();

  const canPlay = task.status === 'todo' || task.status === 'paused';
  const canPause = task.status === 'in-progress';
  const canStop = task.status === 'in-progress' || task.status === 'paused';
  const tid = task._id || task.projectId;

  return (
    <TouchableOpacity style={tc.card} onPress={onPress} activeOpacity={0.82}>
      <View style={tc.topRow}>
        <Text style={tc.title} numberOfLines={2}>{task.title}</Text>
        <Badge label={task.priority} variant={PRIORITY_VARIANT[task.priority] ?? 'neutral'} dot />
      </View>

      <View style={tc.metaRow}>
        <Ionicons name="folder-outline" size={11} color={Colors.gray400} />
        <Text style={tc.metaText} numberOfLines={1}> {task.project || 'General'}</Text>
      </View>

      <View style={tc.bottomRow}>
        <Badge label={task.status.replace('-', ' ')} variant={statusToVariant[task.status] ?? 'neutral'} dot />

        <View style={tc.metaRow}>
          <Ionicons name="flag-outline" size={11} color={isOverdue ? Colors.danger : Colors.gray400} />
          <Text style={[tc.metaText, isOverdue && { color: Colors.danger }]}> {task.dueDate || 'No Due Date'}</Text>
        </View>

        <View style={tc.timeBox}>
          <Ionicons name="time-outline" size={11} color={Colors.gray500} />
          <Text style={tc.timeText}>{formatTimeSpent(task.timeSpent, task.timeSpentSeconds)}</Text>
        </View>
      </View>

      <View style={tc.actionsRow}>
        <TouchableOpacity style={[tc.actionBtn, { backgroundColor: '#E6EFFC' }]} onPress={onView}>
          <Ionicons name="eye-outline" size={13} color="#3E8AFF" />
        </TouchableOpacity>

        {canPlay && (
          <TouchableOpacity style={[tc.actionBtn, { backgroundColor: '#F5F3FF' }]} onPress={() => onStatusChange('in-progress')}>
            <Ionicons name="play-outline" size={13} color="#9136FC" />
          </TouchableOpacity>
        )}

        {canPause && (
          <TouchableOpacity style={[tc.actionBtn, { backgroundColor: '#FEF9C3' }]} onPress={() => onStatusChange('paused')}>
            <Ionicons name="pause-outline" size={13} color="#CA8A04" />
          </TouchableOpacity>
        )}

        {canStop && (
          <TouchableOpacity style={[tc.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => onStatusChange('completed')}>
            <Ionicons name="stop-outline" size={13} color="#DC2626" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[tc.actionBtn, { backgroundColor: '#E3F7EB' }]} onPress={onEdit}>
          <Ionicons name="pencil-outline" size={13} color="#04CA52" />
        </TouchableOpacity>

        <TouchableOpacity style={[tc.actionBtn, { backgroundColor: '#FDEDE3' }]} onPress={onDelete}>
          <Ionicons name="trash-outline" size={13} color="#FF7312" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const tc = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 14, marginBottom: 10, gap: 8, ...Shadow.sm },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { flex: 1, fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.gray900, lineHeight: 19 },
  metaRow: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 11, color: Colors.gray400 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  timeBox: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.gray50, borderRadius: Radius.full, paddingHorizontal: 7, paddingVertical: 3 },
  timeText: { fontSize: 10, fontWeight: '600', color: Colors.gray600 },
  actionsRow: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end', borderTopWidth: 1, borderTopColor: Colors.gray100, paddingTop: 8, marginTop: 4, alignItems: 'center' },
  actionBtn: { width: 26, height: 26, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
});

// ── Grid Card ────────────────────────────────────────────────
function GridCard({ task, onPress, cardWidth, onView, onEdit, onDelete, onStatusChange }: {
  task: Task;
  onPress: () => void;
  cardWidth: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: Status) => void;
}) {
  const canPlay = task.status === 'todo' || task.status === 'paused';
  const canPause = task.status === 'in-progress';
  const canStop = task.status === 'in-progress' || task.status === 'paused';

  return (
    <TouchableOpacity style={[gc.card, { width: cardWidth }]} onPress={onPress} activeOpacity={0.85}>
      <View style={gc.topRow}>
        <Badge label={task.priority} variant={PRIORITY_VARIANT[task.priority] ?? 'neutral'} />
        <Badge label={task.status.replace('-', ' ')} variant={statusToVariant[task.status] ?? 'neutral'} />
      </View>
      <Text style={gc.title} numberOfLines={2}>{task.title}</Text>
      <View style={gc.metaRow}>
        <Ionicons name="folder-outline" size={11} color={Colors.gray500} />
        <Text style={gc.meta} numberOfLines={1}> {task.project || 'General'}</Text>
      </View>
      <View style={gc.dueRow}>
        <Ionicons name="calendar-outline" size={11} color={Colors.gray400} />
        <Text style={gc.due}> {task.dueDate || 'No Due Date'}</Text>
      </View>

      <View style={gc.actions}>
        <TouchableOpacity style={[gc.actionBtn, { backgroundColor: '#E6EFFC' }]} onPress={onView}>
          <Ionicons name="eye-outline" size={12} color="#3E8AFF" />
        </TouchableOpacity>

        {canPlay && (
          <TouchableOpacity style={[gc.actionBtn, { backgroundColor: '#F5F3FF' }]} onPress={() => onStatusChange('in-progress')}>
            <Ionicons name="play-outline" size={12} color="#9136FC" />
          </TouchableOpacity>
        )}

        {canPause && (
          <TouchableOpacity style={[gc.actionBtn, { backgroundColor: '#FEF9C3' }]} onPress={() => onStatusChange('paused')}>
            <Ionicons name="pause-outline" size={12} color="#CA8A04" />
          </TouchableOpacity>
        )}

        {canStop && (
          <TouchableOpacity style={[gc.actionBtn, { backgroundColor: '#FEE2E2' }]} onPress={() => onStatusChange('completed')}>
            <Ionicons name="stop-outline" size={12} color="#DC2626" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[gc.actionBtn, { backgroundColor: '#E3F7EB' }]} onPress={onEdit}>
          <Ionicons name="pencil-outline" size={12} color="#04CA52" />
        </TouchableOpacity>

        <TouchableOpacity style={[gc.actionBtn, { backgroundColor: '#FDEDE3' }]} onPress={onDelete}>
          <Ionicons name="trash-outline" size={12} color="#FF7312" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const gc = StyleSheet.create({
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 14, ...Shadow.sm },
  topRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  title: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.gray900, lineHeight: 19, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  meta: { fontSize: 11, color: Colors.gray400 },
  dueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  due: { fontSize: 11, color: Colors.gray400 },
  actions: { flexDirection: 'row', gap: 4, justifyContent: 'flex-start', marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.gray100, paddingTop: 8, alignItems: 'center' },
  actionBtn: { width: 24, height: 24, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
});

// ── Main Screen ──────────────────────────────────────────────
export default function TaskScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isSmall = width < 400;

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [priority, setPriority] = useState('All');
  const [status, setStatus] = useState('All');
  const [project, setProject] = useState('All Projects');
  const [showPriDrop, setShowPriDrop] = useState(false);
  const [showStaDrop, setShowStaDrop] = useState(false);
  const [showPrjDrop, setShowPrjDrop] = useState(false);

  // Tasks API State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Role & Admin Task Stats State
  const [userRole, setUserRole] = useState<'employee' | 'superadmin' | 'hr' | 'manager'>('employee');
  const [adminStats, setAdminStats] = useState<any>(null);

  // Modal Views
  const [viewTask, setViewTask] = useState<Task | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);

  // Create Task Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProject, setNewProject] = useState('HRMS Mobile App');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDueDate, setNewDueDate] = useState(
    new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);

  // ── Load Role Check & Statistics ──
  useEffect(() => {
    const checkRoleAndLoadStats = async () => {
      try {
        const profileData = await fetchProfile();
        if (profileData && profileData.user) {
          const role = profileData.user.role || 'employee';
          setUserRole(role);
          if (role === 'superadmin' || role === 'hr' || role === 'manager') {
            const statsRes = await fetchTaskStatisticsCounts().catch(() => null);
            if (statsRes && statsRes.success) {
              setAdminStats(statsRes.data);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to load profile/stats for TaskScreen:', err);
      }
    };
    checkRoleAndLoadStats();
  }, []);

  // ── Load Tasks ──
  const loadTasks = async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      if (userRole === 'superadmin' || userRole === 'hr' || userRole === 'manager') {
        const apiStatus = status !== 'All' ? (status === 'To Do' ? 'Pending' : status === 'In Progress' ? 'In Progress' : 'Completed') : undefined;
        const res = await fetchAllTasks({
          page: 1,
          limit: 100,
          status: apiStatus
        });
        if (res && res.success && Array.isArray(res.data)) {
          setTasks(res.data);
        } else {
          setTasks([]);
        }
      } else {
        // Map UI options to API params
        const apiParams: any = {};
        if (search.trim()) apiParams.search = search.trim();
        if (priority !== 'All') apiParams.priority = priority.toLowerCase();
        if (status !== 'All') {
          let apiStatus = status;
          if (status === 'To Do') apiStatus = 'todo';
          else if (status === 'In Progress') apiStatus = 'in_progress';
          else if (status === 'Completed') apiStatus = 'done';
          apiParams.status = apiStatus;
        }
        if (project !== 'All Projects') {
          apiParams.projectId = PROJECT_IDS[project];
        }

        const data = await fetchTasks(apiParams);
        let list: any[] = [];
        if (data && data.items && Array.isArray(data.items)) {
          list = data.items;
        } else if (Array.isArray(data)) {
          list = data;
        } else if (data && typeof data === 'object') {
          if (Array.isArray((data as any).items)) {
            list = (data as any).items;
          } else if (Array.isArray((data as any).tasks)) {
            list = (data as any).tasks;
          } else if (Array.isArray((data as any).data)) {
            list = (data as any).data;
          }
        }
        setTasks(list);
      }
    } catch (err) {
      console.warn('Failed to fetch tasks from API:', err);
      setTasks([]);
    } finally {
      if (showIndicator) setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [search, priority, status, project, userRole]);

  const handleStatusChange = async (id: string, st: Status) => {
    try {
      if (userRole === 'superadmin' || userRole === 'hr' || userRole === 'manager') {
        const apiStatus = st === 'completed' ? 'Completed' : st === 'in-progress' ? 'In Progress' : 'Pending';
        await updateTaskStatusPatch(id, apiStatus);
        setTasks(prev => prev.map(t => (t._id || t.projectId) === id ? { ...t, status: st } : t));
        const statsRes = await fetchTaskStatisticsCounts().catch(() => null);
        if (statsRes && statsRes.success) {
          setAdminStats(statsRes.data);
        }
      } else {
        if (st === 'in-progress') {
          const res = await startTaskTimerApi(id);
          if (res && res.success && res.task) {
            setTasks(prev => prev.map(t => (t._id || t.projectId) === id ? { ...t, ...res.task } : t));
          }
        } else if (st === 'paused') {
          const res = await pauseTaskTimerApi(id);
          if (res && res.success && res.task) {
            setTasks(prev => prev.map(t => (t._id || t.projectId) === id ? { ...t, ...res.task } : t));
          }
        } else if (st === 'completed') {
          const res = await endTaskTimerApi(id);
          if (res && res.success && res.task) {
            setTasks(prev => prev.map(t => (t._id || t.projectId) === id ? { ...t, ...res.task } : t));
          }
        } else {
          const res = await updateTaskStatusApi(id, st);
          if (res && res.success) {
            setTasks(prev => prev.map(t => (t._id || t.projectId) === id ? { ...t, status: st } : t));
          }
        }
      }
    } catch (err: any) {
      console.warn('API status change failed, updating locally:', err);
      setTasks(prev => prev.map(t => (t._id || t.projectId) === id ? { ...t, status: st } : t));
    }
  };

  const handlePauseAllTimers = async () => {
    try {
      const res = await pauseAllTimersApi();
      if (res && res.success) {
        Alert.alert('Success', `Successfully paused all active task timers (Paused count: ${res.pausedCount}).`);
        loadTasks(false);
      }
    } catch (err: any) {
      console.warn('Failed to pause all timers:', err);
      Alert.alert('Error', err.message || 'Failed to pause all timers.');
    }
  };

  const handleSave = async (updated: Task) => {
    const taskId = updated._id || updated.projectId;
    const original = tasks.find(t => (t._id || t.projectId) === taskId);
    if (original && original.status !== updated.status) {
      try {
        await handleStatusChange(taskId, updated.status as Status);
      } catch (err) {
        console.warn('Failed to update task status in save:', err);
      }
    }
    setTasks(prev => prev.map(t => (t._id || t.projectId) === taskId ? { ...t, title: updated.title, priority: updated.priority } : t));
    setEditTask(null);
  };

  // ── Submit Create Task ──
  const handleCreateTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title.');
      return;
    }
    setFormLoading(true);
    try {
      const formData = new FormData();
      formData.append('projectId', PROJECT_IDS[newProject] || '60d0feb25311236168a109d9');
      formData.append('title', newTitle.trim());
      formData.append('priority', newPriority.charAt(0).toUpperCase() + newPriority.slice(1));

      // If we selected assignees, append them
      formData.append('assignees', JSON.stringify(selectedAssignees));
      formData.append('startDate', newStartDate.trim());
      formData.append('dueDate', newDueDate.trim());

      const res = await createTask(formData);
      if (res && res.task) {
        Alert.alert('Success', 'Task created successfully.');
        setShowAddModal(false);
        // Reset form
        setNewTitle('');
        setSelectedAssignees([]);
        loadTasks(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create task.');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Task Deletion ──
  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTask(id);
              Alert.alert('Success', 'Task deleted successfully.');
              setTasks(prev => prev.filter(t => (t._id || t.projectId) !== id));
            } catch (err: any) {
              setTasks(prev => prev.filter(t => (t._id || t.projectId) !== id));
              Alert.alert('Success', 'Task deleted successfully locally.');
            }
          }
        },
      ],
    );
  };

  const closeAll = () => { setShowPriDrop(false); setShowStaDrop(false); setShowPrjDrop(false); };

  const byStatus = (s: Status) => tasks.filter(t => t.status === s);
  const statCounts: Record<string, number> = {
    total: adminStats ? adminStats.totalTasks : tasks.length,
    'in-progress': adminStats ? adminStats.inProgress : byStatus('in-progress').length,
    completed: adminStats ? adminStats.completed : byStatus('completed').length,
    overdue: adminStats ? adminStats.overdue : tasks.filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < new Date()).length,
  };

  const filteredTasks = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    const matchPriority = priority === 'All' || t.priority.toLowerCase() === priority.toLowerCase();
    const matchStatus =
      status === 'All' ||
      (status === 'To Do' && t.status === 'todo') ||
      (status === 'In Progress' && t.status === 'in-progress') ||
      (status === 'Completed' && t.status === 'completed');
    const matchProject = project === 'All Projects' || t.project === project;
    return matchSearch && matchPriority && matchStatus && matchProject;
  });

  const GRID_GAP = 10;
  const PADDING = Spacing[4] * 2;
  const gridCardW = (width - PADDING - GRID_GAP) / 2;

  const toggleAssignee = (id: string) => {
    setSelectedAssignees(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />

      {/* ── Header ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.pageTitle}>
              {userRole === 'superadmin' || userRole === 'hr' || userRole === 'manager' ? 'All Tasks' : 'My Tasks'}
            </Text>
            <Text style={s.pageSubtitle}>
              {userRole === 'superadmin' || userRole === 'hr' || userRole === 'manager'
                ? `${tasks.length} tasks active in the organization`
                : `${tasks.length} tasks assigned to you`}
            </Text>
          </View>
          <View style={s.segmented}>
            {([
              { mode: 'list', icon: 'list-outline' as IoniconName, label: 'List' },
              { mode: 'grid', icon: 'grid-outline' as IoniconName, label: 'Grid' },
              { mode: 'table', icon: 'apps-outline' as IoniconName, label: 'Table' },
            ] as { mode: ViewMode; icon: IoniconName; label: string }[]).map(({ mode, icon, label }) => (
              <TouchableOpacity
                key={mode}
                style={[s.segBtn, viewMode === mode && s.segBtnActive]}
                onPress={() => setViewMode(mode)}
              >
                <Ionicons
                  name={icon}
                  size={14}
                  color={viewMode === mode ? Colors.white : Colors.gray500}
                />
                {!isSmall && (
                  <Text style={[s.segBtnText, viewMode === mode && s.segBtnTextActive]}>
                    {label}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {loading ? (
        <View style={st.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={st.loadingText}>Fetching your tasks list...</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={closeAll}
        >
          {/* Stats 2×2 grid */}
          <View style={s.statsGrid}>
            {STAT_CARDS.map(card => (
              <View key={card.key} style={s.statCard}>
                <View style={[s.statIcon, { backgroundColor: card.iconBg }]}>
                  <Ionicons
                    name={card.icon}
                    size={22}
                    color={card.iconColor}
                  />
                </View>

                <View style={s.statContent}>
                  <Text style={s.statLabel}>{card.label}</Text>
                  <Text style={s.statValue}>{statCounts[card.key]}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Filter Bar */}
          <View style={s.filterBar}>
            <View style={s.searchBox}>
              <Ionicons name="search-outline" size={16} color={'#A4A4AD'} />
              <TextInput
                style={s.searchInput}
                placeholder="Search tasks..."
                placeholderTextColor={'#A4A4AD'}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={16} color={Colors.gray400} />
                </TouchableOpacity>
              )}
            </View>

            <View style={s.dropRow}>
              <Dropdown
                value={priority} options={PRIORITY_OPTIONS} open={showPriDrop}
                onToggle={() => { setShowPriDrop(v => !v); setShowStaDrop(false); setShowPrjDrop(false); }}
                onSelect={o => { setPriority(o); setShowPriDrop(false); }}
              />
              <Dropdown
                value={status} options={STATUS_OPTIONS} open={showStaDrop}
                onToggle={() => { setShowStaDrop(v => !v); setShowPriDrop(false); setShowPrjDrop(false); }}
                onSelect={o => { setStatus(o); setShowStaDrop(false); }}
              />
              <Dropdown
                value={project === 'All Projects' ? 'Project' : project.split(' ')[0]}
                options={PROJECT_OPTIONS} open={showPrjDrop} alignRight
                onToggle={() => { setShowPrjDrop(v => !v); setShowPriDrop(false); setShowStaDrop(false); }}
                onSelect={o => { setProject(o); setShowPrjDrop(false); }}
              />
            </View>

            {/* Action Buttons Row */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {userRole !== 'superadmin' && (
                <TouchableOpacity style={[s.addBtn, { flex: 1 }]} onPress={() => setShowAddModal(true)} activeOpacity={0.85}>
                  <Ionicons name="add" size={16} color={Colors.white} />
                  <Text style={s.addBtnText}>Add Task</Text>
                </TouchableOpacity>
              )}
              {/* <TouchableOpacity
                style={[s.addBtn, { backgroundColor: '#FFA05D', flex: 1 }]}
                onPress={handlePauseAllTimers}
                activeOpacity={0.85}
              >
                <Ionicons name="pause-circle-outline" size={16} color={Colors.white} />
                <Text style={s.addBtnText}>Pause All</Text>
              </TouchableOpacity> */}
            </View>
          </View>

          {/* Content */}
          {filteredTasks.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="search-outline" size={40} color={Colors.gray300} />
              <Text style={s.emptyText}>No tasks match your filters</Text>
            </View>
          ) : viewMode === 'table' ? (
            <TaskTable
              tasks={filteredTasks}
              onView={setViewTask}
              onEdit={setEditTask}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ) : viewMode === 'grid' ? (
            <View style={s.gridContainer}>
              {filteredTasks.map(task => (
                <GridCard
                  key={task._id || task.projectId}
                  task={task}
                  cardWidth={gridCardW}
                  onView={() => setViewTask(task)}
                  onEdit={() => setEditTask(task)}
                  onDelete={() => handleDelete(task._id)}
                  onStatusChange={(st) => handleStatusChange(task._id, st)}
                  onPress={() => setViewTask(task)}
                />
              ))}
            </View>
          ) : (
            <View>
              {filteredTasks.map(task => (
                <TaskCard
                  key={task._id || task.projectId}
                  task={task}
                  onView={() => setViewTask(task)}
                  onEdit={() => setEditTask(task)}
                  onDelete={() => handleDelete(task._id)}
                  onStatusChange={(st) => handleStatusChange(task._id, st)}
                  onPress={() => setViewTask(task)}
                />
              ))}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {viewTask && <ViewModal task={viewTask} onClose={() => setViewTask(null)} />}
      {editTask && <EditModal task={editTask} onSave={handleSave} onClose={() => setEditTask(null)} />}

      {/* Add Task Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent onRequestClose={() => setShowAddModal(false)}>
        <View style={st.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.modalCard}>
            <View style={st.modalHeader}>
              <View>
                <Text style={st.modalTitle}>Create Task</Text>
                <Text style={st.modalSub}>Assign deliverables to project streams</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddModal(false)} style={st.modalClose}>
                <Ionicons name="close" size={20} color={Colors.gray600} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
              <Text style={st.fieldLabel}>Project *</Text>
              <View style={st.pickerContainer}>
                {['HRMS Mobile App', 'MMNext Platform'].map(p => (
                  <TouchableOpacity key={p} style={[st.pickerChip, newProject === p && st.pickerChipActive]} onPress={() => setNewProject(p)}>
                    <Text style={[st.pickerChipText, newProject === p && st.pickerChipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={st.fieldLabel}>Task Title *</Text>
              <TextInput style={st.textInput} value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Implement Oauth2 Flow" placeholderTextColor="#A4A4AD" />

              <Text style={st.fieldLabel}>Priority Level</Text>
              <View style={st.pickerContainer}>
                {(['low', 'medium', 'high'] as const).map(p => (
                  <TouchableOpacity key={p} style={[st.pickerChip, newPriority === p && st.pickerChipActive]} onPress={() => setNewPriority(p)}>
                    <Text style={[st.pickerChipText, newPriority === p && st.pickerChipTextActive]}>{p.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={st.fieldLabel}>Start Date (YYYY-MM-DD) *</Text>
              <TextInput style={st.textInput} value={newStartDate} onChangeText={setNewStartDate} placeholder="YYYY-MM-DD" placeholderTextColor="#A4A4AD" />

              <Text style={st.fieldLabel}>Due Date (YYYY-MM-DD) *</Text>
              <TextInput style={st.textInput} value={newDueDate} onChangeText={setNewDueDate} placeholder="YYYY-MM-DD" placeholderTextColor="#A4A4AD" />

              <Text style={st.fieldLabel}>Assignees (Team Members)</Text>
              <View style={st.pickerContainer}>
                {mockEmployees.map(emp => {
                  const selected = selectedAssignees.includes(emp.id);
                  return (
                    <TouchableOpacity key={emp.id} style={[st.pickerChip, selected && st.pickerChipActive]} onPress={() => toggleAssignee(emp.id)}>
                      <Text style={[st.pickerChipText, selected && st.pickerChipTextActive]}>{emp.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={st.modalActions}>
                <TouchableOpacity style={st.modalCancelBtn} onPress={() => setShowAddModal(false)}>
                  <Text style={st.modalCancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={st.modalSubmitBtn} onPress={handleCreateTask} disabled={formLoading}>
                  {formLoading ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={st.modalSubmitTxt}>Save Task</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

// ── Additional Styles ──
const st = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 120 },
  loadingText: { fontSize: 13, color: '#6B7280', marginTop: 10, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingHorizontal: 20, paddingTop: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.gray900 },
  modalSub: { fontSize: 12, color: Colors.gray400, marginTop: 2 },
  modalClose: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.gray100, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: Colors.gray600, marginTop: 12, marginBottom: 6, letterSpacing: 0.2, textTransform: 'uppercase' },
  textInput: { height: 46, backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1.5, borderColor: '#E4E4E7', paddingHorizontal: 14, fontSize: 13, color: Colors.gray900 },
  pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  pickerChip: { backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: '#E4E4E7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  pickerChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pickerChipText: { fontSize: 11, color: Colors.gray600, fontWeight: '700' },
  pickerChipTextActive: { color: Colors.white },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20, marginBottom: 20 },
  modalCancelBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#E4E4E7', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white },
  modalCancelTxt: { fontSize: 14, fontWeight: '700', color: Colors.gray600 },
  modalSubmitBtn: { flex: 2, height: 48, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  modalSubmitTxt: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.white, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 56, paddingHorizontal: Spacing[4], paddingBottom: Spacing[4], borderBottomWidth: 1, borderBottomColor: Colors.gray100, ...Shadow.sm },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pageTitle: { fontSize: Typography.fontSize.xl, fontWeight: '800', color: Colors.gray900 },
  pageSubtitle: { fontSize: Typography.fontSize.xs, color: Colors.gray500, marginTop: 2 },
  segmented: { flexDirection: 'row', backgroundColor: Colors.gray100, borderRadius: Radius.lg, padding: 3, flexShrink: 1 },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radius.md },
  segBtnActive: { backgroundColor: Colors.primary, ...Shadow.sm },
  segBtnText: { fontSize: Typography.fontSize.xs, fontWeight: '600', color: Colors.gray500 },
  segBtnTextActive: { color: Colors.white },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing[4] },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing[4] },
  statCard: { width: '47.5%', backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 12, flexDirection: 'row', alignItems: 'center', ...Shadow.sm },
  statIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12, ...IconBox.shadow as any },
  statContent: { flex: 1 },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#45556C', marginBottom: 2 },
  statValue: { fontSize: 24, fontWeight: '800', color: Colors.gray900 },
  filterBar: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing[3], marginBottom: Spacing[4], gap: 10, ...Shadow.sm, zIndex: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F9FAFB', borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 9, borderColor: '#E4E4E7', borderWidth: 1 },
  searchInput: { flex: 1, fontSize: Typography.fontSize.sm, color: Colors.gray900, padding: 0 },
  dropRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, zIndex: 10 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 10, ...Shadow.sm },
  addBtnText: { fontSize: Typography.fontSize.sm, fontWeight: '700', color: Colors.white },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  empty: { alignItems: 'center', paddingVertical: 56, gap: 12 },
  emptyText: { fontSize: Typography.fontSize.sm, color: Colors.gray400 },
  calendarPlaceholder: { alignItems: 'center', paddingVertical: 64, gap: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingHorizontal: 20, paddingTop: 20 },
});
