import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ApiError,
  createLeaveType,
  createPolicyDraft,
  deactivateLeaveType,
  getManagedLeaveTypes,
  getPolicySettingsOverview,
  reactivateLeaveType,
  reorderLeaveTypes,
  updateLeaveType,
} from "../../api/client";
import { fieldErrorsFromApiError } from "../../api/fieldViolations";
import { isolate } from "../../i18n/bidi";
import {
  LEAVE_TYPE_DEFAULT_PRESENTATION,
  nextEffectiveDate,
} from "./leaveTypeDefaults";
import type { LeaveTypeResponse } from "../../api/generated/types";
import { useAuth } from "../../auth/useAuth";
import { Modal } from "../../components/ui/Modal";
import { CloseIcon, PlusIcon } from "../../components/ui/icons";
import "./team-members.css";

type Props = {
  onWarning?: (message: string) => void;
  onSuccess?: (message: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
};
export function LeaveTypesCard({
  onWarning,
  onSuccess,
  onDirtyChange,
}: Props) {
  const { t } = useTranslation("settings");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [statusTarget, setStatusTarget] = useState<{
    publicId: string;
    name: string;
    active: boolean;
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState(LEAVE_TYPE_DEFAULT_PRESENTATION.color);
  const [backgroundColor, setBackgroundColor] = useState(
    LEAVE_TYPE_DEFAULT_PRESENTATION.backgroundColor,
  );
  const [borderColor, setBorderColor] = useState(
    LEAVE_TYPE_DEFAULT_PRESENTATION.borderColor,
  );
  const [presenceType, setPresenceType] = useState<"WFH" | "OFF">(
    LEAVE_TYPE_DEFAULT_PRESENTATION.presenceType,
  );
  const [editTarget, setEditTarget] = useState<LeaveTypeResponse | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const orgId = user?.organizationId;
  // The create and edit modals share these fields, so opening either one must start from a known
  // state — otherwise "Add Leave Type" after an edit opens pre-filled with the edited type.
  const resetForm = () => {
    setName("");
    setIcon("");
    setColor(LEAVE_TYPE_DEFAULT_PRESENTATION.color);
    setBackgroundColor(LEAVE_TYPE_DEFAULT_PRESENTATION.backgroundColor);
    setBorderColor(LEAVE_TYPE_DEFAULT_PRESENTATION.borderColor);
    setPresenceType(LEAVE_TYPE_DEFAULT_PRESENTATION.presenceType);
    setFieldErrors({});
  };
  const typesQuery = useQuery({
    queryKey: ["managed-leave-types", orgId],
    queryFn: getManagedLeaveTypes,
    enabled: orgId != null,
  });
  const overviewQuery = useQuery({
    queryKey: ["policy-settings-overview", orgId],
    queryFn: getPolicySettingsOverview,
    enabled: orgId != null,
  });
  useEffect(() => {
    if (typesQuery.isError) onWarning?.(t("leaveTypes.errors.loadToast"));
  }, [typesQuery.isError, onWarning, t]);
  // An open create/edit modal holds unsaved input, so the Settings exit guard has to know about it
  // — the same contract TeamMembersCard honours for its own modal.
  const formOpen = createOpen || editTarget != null;
  const formDirty =
    formOpen &&
    (name.trim().length > 0 ||
      icon.trim().length > 0 ||
      (editTarget != null &&
        (name !== (editTarget.name ?? "") ||
          icon !== (editTarget.icon ?? "") ||
          color !== (editTarget.color ?? LEAVE_TYPE_DEFAULT_PRESENTATION.color) ||
          backgroundColor !==
            (editTarget.backgroundColor ??
              LEAVE_TYPE_DEFAULT_PRESENTATION.backgroundColor) ||
          borderColor !==
            (editTarget.borderColor ??
              LEAVE_TYPE_DEFAULT_PRESENTATION.borderColor) ||
          presenceType !==
            (editTarget.presenceType ??
              LEAVE_TYPE_DEFAULT_PRESENTATION.presenceType))));
  useEffect(() => {
    onDirtyChange?.(formDirty);
  }, [formDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  const handleFormError = (cause: unknown, message: string) => {
    const violations =
      cause instanceof ApiError
        ? fieldErrorsFromApiError(cause.fieldViolations)
        : null;
    setFieldErrors(violations ?? {});
    if (violations) {
      const ids: Record<string, string> = {
        name: "leave-type-name",
        icon: "leave-type-icon",
        presenceType: "leave-type-presence",
        color: "leave-type-color",
        backgroundColor: "leave-type-background-color",
        borderColor: "leave-type-border-color",
      };
      const target = Object.keys(violations)
        .map((field) => ids[field])
        .find(Boolean);
      const focusTarget = target ? document.getElementById(target) : null;
      // Every id in `ids` is rendered by both modals, so a violation on any validated field lands
      // on its own control; the name input is the fallback for a field the form does not expose.
      (focusTarget ?? document.getElementById("leave-type-name"))?.focus();
    }
    onWarning?.(message);
  };
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["managed-leave-types", orgId],
      }),
      queryClient.invalidateQueries({
        queryKey: ["policy-settings-overview", orgId],
      }),
      queryClient.invalidateQueries({ queryKey: ["leave-types", orgId] }),
    ]);
  };
  const statusMutation = useMutation({
    mutationFn: (target: NonNullable<typeof statusTarget>) =>
      target.active
        ? deactivateLeaveType(target.publicId)
        : reactivateLeaveType(target.publicId),
    onSuccess: async (_, target) => {
      await refresh();
      setStatusTarget(null);
      onSuccess?.(
        t(
          target.active
            ? "leaveTypes.success.deactivated"
            : "leaveTypes.success.reactivated",
          { name: target.name },
        ),
      );
    },
    onError: () => onWarning?.(t("leaveTypes.errors.status")),
  });
  const createMutation = useMutation({
    mutationFn: () =>
      createLeaveType({
        name,
        icon,
        color,
        backgroundColor,
        borderColor,
        presenceType,
      }),
    onSuccess: async () => {
      await refresh();
      setCreateOpen(false);
      resetForm();
      onSuccess?.(t("leaveTypes.success.created"));
    },
    onError: (cause) => handleFormError(cause, t("leaveTypes.errors.create")),
  });
  const editMutation = useMutation({
    mutationFn: () =>
      updateLeaveType(editTarget!.publicId!, {
        name,
        icon,
        color,
        backgroundColor,
        borderColor,
        presenceType,
      }),
    onSuccess: async () => {
      await refresh();
      setEditTarget(null);
      resetForm();
      onSuccess?.(t("leaveTypes.success.updated"));
    },
    onError: (cause) => handleFormError(cause, t("leaveTypes.errors.update")),
  });
  const reorderMutation = useMutation({
    mutationFn: reorderLeaveTypes,
    onSuccess: refresh,
    onError: () => onWarning?.(t("leaveTypes.errors.reorder")),
  });
  const draftMutation = useMutation({
    mutationFn: (type: NonNullable<typeof typesQuery.data>[number]) =>
      createPolicyDraft({
        leaveTypePublicId: type.publicId!,
        mode:
          type.defaultBalanceDays == null ? "UNLIMITED" : "ANNUAL_ALLOWANCE",
        allowanceDays: type.defaultBalanceDays ?? undefined,
        balancePeriod: "CALENDAR_YEAR",
        scope: "ORGANIZATION",
        effectiveFrom: nextEffectiveDate(user?.organizationTimezone),
      }),
    onSuccess: (draft) =>
      navigate(`/settings/leave-policies/${draft.draftPublicId}`),
    onError: () => onWarning?.(t("leaveTypes.errors.draft")),
  });
  const move = (index: number, offset: number) => {
    // Filter before mapping: dropping an id after the map would shorten the array and desynchronise
    // it from `index`, which comes from the unfiltered render list, and swap unrelated rows.
    const rows = (typesQuery.data ?? []).filter((type) => Boolean(type.publicId));
    const target = index + offset;
    if (
      rows.length !== (typesQuery.data ?? []).length ||
      index < 0 ||
      target < 0 ||
      index >= rows.length ||
      target >= rows.length
    ) {
      onWarning?.(t("leaveTypes.errors.reorder"));
      return;
    }
    const ids = rows.map((type) => type.publicId!);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  };
  if (typesQuery.isPending)
    return (
      <section
        className="settings-card settings-card-spaced"
        data-testid="leave-types-card"
      >
        <div className="card-section-header">
          <span className="card-section-title">{t("leaveTypes.title")}</span>
        </div>
        <p className="settings-card-loading-inline">{t("leaveTypes.loading")}</p>
      </section>
    );
  if (typesQuery.isError)
    return (
      <section
        className="settings-card settings-card-spaced"
        data-testid="leave-types-card"
      >
        <div className="card-section-header">
          <span className="card-section-title">{t("leaveTypes.title")}</span>
        </div>
        <p className="settings-card-error-inline">
          {t("leaveTypes.errors.load")}
        </p>
      </section>
    );
  const types = typesQuery.data ?? [];
  const balanceCopy = (type: NonNullable<typeof typesQuery.data>[number]) =>
    type.defaultBalanceDays == null
      ? t("leaveTypes.unlimited")
      : t("leaveTypes.defaultDays", { count: type.defaultBalanceDays });
  return (
    <section
      className="settings-card settings-card-spaced"
      data-testid="leave-types-card"
    >
      <div className="card-section-header">
        <div>
          <span className="card-section-title">{t("leaveTypes.title")}</span>
          <p className="settings-card-helper settings-card-helper-inline">
            {t("leaveTypes.summary", { count: types.length })}
          </p>
        </div>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={() => {
            resetForm();
            setCreateOpen(true);
          }}
        >
          <PlusIcon size={16} />
          {t("leaveTypes.actions.add")}
        </button>
      </div>
      {overviewQuery.isError && (
        <div role="alert" className="settings-card-error-inline">
          <p>{t("leaveTypes.errors.overview")}</p>
          <button
            className="btn btn-outline btn-sm"
            type="button"
            onClick={() => overviewQuery.refetch()}
          >
            {t("leaveTypes.actions.retry")}
          </button>
        </div>
      )}
      {types.length === 0 ? (
        <p className="settings-card-loading-inline">{t("leaveTypes.none")}</p>
      ) : (
        <div className="settings-list-body" data-testid="leave-types-list">
          {types.map((type, index) => {
            const policy = overviewQuery.data?.leaveTypes.find(
              (item) => item.leaveTypePublicId === type.publicId,
            );
            return (
              <div
                key={type.publicId ?? type.id}
                className="settings-list-item leave-type-row"
                data-testid={`leave-type-row-${type.id}`}
              >
                <span className="leave-type-icon" aria-hidden="true">
                  {type.icon}
                </span>
                <div className="leave-type-details">
                  <div className="leave-type-name">
                  <bdi>{type.name}</bdi>
                </div>
                  <div className="leave-type-subtitle">
                    <span>{balanceCopy(type)}</span> ·{" "}
                    <span>
                      {t(
                        type.active === false
                          ? "leaveTypes.inactive"
                          : "leaveTypes.active",
                      )}
                    </span>
                  </div>
                </div>
                <div className="leave-type-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={index === 0 || reorderMutation.isPending}
                    onClick={() => move(index, -1)}
                    aria-label={t("leaveTypes.aria.moveUp", {
                      name: isolate(type.name),
                    })}
                  >
                    {t("leaveTypes.actions.up")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={
                      index === types.length - 1 || reorderMutation.isPending
                    }
                    onClick={() => move(index, 1)}
                    aria-label={t("leaveTypes.aria.moveDown", {
                      name: isolate(type.name),
                    })}
                  >
                    {t("leaveTypes.actions.down")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    aria-label={t("leaveTypes.aria.edit", {
                      name: isolate(type.name),
                    })}
                    onClick={() => {
                      setFieldErrors({});
                      setEditTarget(type);
                      setName(type.name ?? "");
                      setIcon(type.icon ?? "");
                      setColor(type.color ?? "#093C5D");
                      setBackgroundColor(type.backgroundColor ?? "#D6E8ED");
                      setBorderColor(type.borderColor ?? "#0E4F75");
                      setPresenceType(type.presenceType ?? "OFF");
                    }}
                  >
                    {t("leaveTypes.actions.edit")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() =>
                      setStatusTarget({
                        publicId: type.publicId!,
                        name: type.name!,
                        active: type.active !== false,
                      })
                    }
                    aria-label={t(
                      type.active === false
                        ? "leaveTypes.aria.reactivate"
                        : "leaveTypes.aria.deactivate",
                      { name: isolate(type.name) },
                    )}
                  >
                    {t(
                      type.active === false
                        ? "leaveTypes.actions.reactivate"
                        : "leaveTypes.actions.deactivate",
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    aria-label={t(
                      policy?.latestDraft
                        ? "leaveTypes.aria.resume"
                        : "leaveTypes.aria.configure",
                      { name: isolate(type.name) },
                    )}
                    disabled={
                      !overviewQuery.isSuccess || draftMutation.isPending
                    }
                    onClick={() =>
                      !overviewQuery.isSuccess
                        ? undefined
                        : policy?.latestDraft?.draftPublicId
                          ? navigate(
                              `/settings/leave-policies/${policy.latestDraft.draftPublicId}`,
                            )
                          : draftMutation.mutate(type)
                    }
                  >
                    {t(
                      policy?.latestDraft
                        ? "leaveTypes.actions.resume"
                        : "leaveTypes.actions.configure",
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {statusTarget && (
        <Modal
          labelledBy="leave-type-status-title"
          onClose={() => setStatusTarget(null)}
        >
          <div className="modal-header">
            <h2 id="leave-type-status-title" className="modal-title">
              {t(
                statusTarget.active
                  ? "leaveTypes.deactivateTitle"
                  : "leaveTypes.reactivateTitle",
                { name: statusTarget.name },
              )}
            </h2>
            <button
              type="button"
              className="modal-close"
              aria-label={t("leaveTypes.actions.close")}
              onClick={() => setStatusTarget(null)}
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <div className="modal-body">
            <p>
              {t("leaveTypes.statusCopy", {
                name: isolate(statusTarget.name),
              })}
            </p>
          </div>
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => setStatusTarget(null)}
            >
              {t("leaveTypes.actions.cancel")}
            </button>
            <button
              className={
                statusTarget.active ? "btn btn-danger" : "btn btn-primary"
              }
              type="button"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate(statusTarget)}
            >
              {t(
                statusTarget.active
                  ? "leaveTypes.actions.confirmDeactivate"
                  : "leaveTypes.actions.confirmReactivate",
              )}
            </button>
          </div>
        </Modal>
      )}
      {createOpen && (
        <Modal
          labelledBy="leave-type-create-title"
          onClose={() => setCreateOpen(false)}
        >
          <div className="modal-header">
            <h2 id="leave-type-create-title" className="modal-title">
              {t("leaveTypes.createTitle")}
            </h2>
            <button
              type="button"
              className="modal-close"
              aria-label={t("leaveTypes.actions.close")}
              onClick={() => setCreateOpen(false)}
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <div className="modal-body">
            <label className="form-field">
              <span>{t("leaveTypes.fields.name")}</span>
              <input
                id="leave-type-name"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={
                  fieldErrors.name ? "leave-type-name-error" : undefined
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {fieldErrors.name && (
              <span
                id="leave-type-name-error"
                className="form-error"
                role="alert"
              >
                {fieldErrors.name}
              </span>
            )}
            <label className="form-field">
              <span>{t("leaveTypes.fields.icon")}</span>
              <input
                id="leave-type-icon"
                aria-invalid={Boolean(fieldErrors.icon)}
                aria-describedby={
                  fieldErrors.icon ? "leave-type-icon-error" : undefined
                }
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
              />
            </label>
            {fieldErrors.icon && (
              <span
                id="leave-type-icon-error"
                className="form-error"
                role="alert"
              >
                {fieldErrors.icon}
              </span>
            )}
            <label className="form-field">
              <span>{t("leaveTypes.fields.presence")}</span>
              <select
                id="leave-type-presence"
                aria-invalid={Boolean(fieldErrors.presenceType)}
                aria-describedby={
                  fieldErrors.presenceType
                    ? "leave-type-presence-error"
                    : undefined
                }
                value={presenceType}
                onChange={(e) =>
                  setPresenceType(e.target.value as "WFH" | "OFF")
                }
              >
                <option value="OFF">{t("leaveTypes.presence.off")}</option>
                <option value="WFH">{t("leaveTypes.presence.wfh")}</option>
              </select>
            </label>
            {fieldErrors.presenceType && (
              <span
                id="leave-type-presence-error"
                className="form-error"
                role="alert"
              >
                {fieldErrors.presenceType}
              </span>
            )}
            <label className="form-field">
              <span>{t("leaveTypes.fields.color")}</span>
              <input
                id="leave-type-color"
                type="color"
                aria-invalid={Boolean(fieldErrors.color)}
                aria-describedby={
                  fieldErrors.color ? "leave-type-color-error" : undefined
                }
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            {fieldErrors.color && (
              <span id="leave-type-color-error" className="form-error" role="alert">
                {fieldErrors.color}
              </span>
            )}
            <label className="form-field">
              <span>{t("leaveTypes.fields.backgroundColor")}</span>
              <input
                id="leave-type-background-color"
                type="color"
                aria-invalid={Boolean(fieldErrors.backgroundColor)}
                aria-describedby={
                  fieldErrors.backgroundColor ? "leave-type-background-color-error" : undefined
                }
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
              />
            </label>
            {fieldErrors.backgroundColor && (
              <span id="leave-type-background-color-error" className="form-error" role="alert">
                {fieldErrors.backgroundColor}
              </span>
            )}
            <label className="form-field">
              <span>{t("leaveTypes.fields.borderColor")}</span>
              <input
                id="leave-type-border-color"
                type="color"
                aria-invalid={Boolean(fieldErrors.borderColor)}
                aria-describedby={
                  fieldErrors.borderColor ? "leave-type-border-color-error" : undefined
                }
                value={borderColor}
                onChange={(e) => setBorderColor(e.target.value)}
              />
            </label>
            {fieldErrors.borderColor && (
              <span id="leave-type-border-color-error" className="form-error" role="alert">
                {fieldErrors.borderColor}
              </span>
            )}
          </div>
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => setCreateOpen(false)}
            >
              {t("leaveTypes.actions.cancel")}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={
                !name.trim() || !icon.trim() || createMutation.isPending
              }
              onClick={() => createMutation.mutate()}
            >
              {t("leaveTypes.actions.create")}
            </button>
          </div>
        </Modal>
      )}
      {editTarget && (
        <Modal
          labelledBy="leave-type-edit-title"
          onClose={() => setEditTarget(null)}
        >
          <div className="modal-header">
            <h2 id="leave-type-edit-title" className="modal-title">
              {t("leaveTypes.editTitle", { name: isolate(editTarget.name) })}
            </h2>
            <button
              type="button"
              className="modal-close"
              aria-label={t("leaveTypes.actions.close")}
              onClick={() => setEditTarget(null)}
            >
              <CloseIcon size={18} />
            </button>
          </div>
          <div className="modal-body">
            <label className="form-field">
              <span>{t("leaveTypes.fields.name")}</span>
              <input
                id="leave-type-name"
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={
                  fieldErrors.name ? "leave-type-name-error" : undefined
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {fieldErrors.name && (
              <span
                id="leave-type-name-error"
                className="form-error"
                role="alert"
              >
                {fieldErrors.name}
              </span>
            )}
            <label className="form-field">
              <span>{t("leaveTypes.fields.icon")}</span>
              <input
                id="leave-type-icon"
                aria-invalid={Boolean(fieldErrors.icon)}
                aria-describedby={
                  fieldErrors.icon ? "leave-type-icon-error" : undefined
                }
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
              />
            </label>
            {fieldErrors.icon && (
              <span
                id="leave-type-icon-error"
                className="form-error"
                role="alert"
              >
                {fieldErrors.icon}
              </span>
            )}
            <label className="form-field">
              <span>{t("leaveTypes.fields.presence")}</span>
              <select
                id="leave-type-presence"
                aria-invalid={Boolean(fieldErrors.presenceType)}
                aria-describedby={
                  fieldErrors.presenceType
                    ? "leave-type-presence-error"
                    : undefined
                }
                value={presenceType}
                onChange={(e) =>
                  setPresenceType(e.target.value as "WFH" | "OFF")
                }
              >
                <option value="OFF">{t("leaveTypes.presence.off")}</option>
                <option value="WFH">{t("leaveTypes.presence.wfh")}</option>
              </select>
            </label>
            {fieldErrors.presenceType && (
              <span
                id="leave-type-presence-error"
                className="form-error"
                role="alert"
              >
                {fieldErrors.presenceType}
              </span>
            )}
            <label className="form-field">
              <span>{t("leaveTypes.fields.color")}</span>
              <input
                id="leave-type-color"
                type="color"
                aria-invalid={Boolean(fieldErrors.color)}
                aria-describedby={
                  fieldErrors.color ? "leave-type-color-error" : undefined
                }
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>
            {fieldErrors.color && (
              <span id="leave-type-color-error" className="form-error" role="alert">
                {fieldErrors.color}
              </span>
            )}
            <label className="form-field">
              <span>{t("leaveTypes.fields.backgroundColor")}</span>
              <input
                id="leave-type-background-color"
                type="color"
                aria-invalid={Boolean(fieldErrors.backgroundColor)}
                aria-describedby={
                  fieldErrors.backgroundColor ? "leave-type-background-color-error" : undefined
                }
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
              />
            </label>
            {fieldErrors.backgroundColor && (
              <span id="leave-type-background-color-error" className="form-error" role="alert">
                {fieldErrors.backgroundColor}
              </span>
            )}
            <label className="form-field">
              <span>{t("leaveTypes.fields.borderColor")}</span>
              <input
                id="leave-type-border-color"
                type="color"
                aria-invalid={Boolean(fieldErrors.borderColor)}
                aria-describedby={
                  fieldErrors.borderColor ? "leave-type-border-color-error" : undefined
                }
                value={borderColor}
                onChange={(e) => setBorderColor(e.target.value)}
              />
            </label>
            {fieldErrors.borderColor && (
              <span id="leave-type-border-color-error" className="form-error" role="alert">
                {fieldErrors.borderColor}
              </span>
            )}
          </div>
          <div className="modal-actions">
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => setEditTarget(null)}
            >
              {t("leaveTypes.actions.cancel")}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={!name.trim() || !icon.trim() || editMutation.isPending}
              onClick={() => editMutation.mutate()}
            >
              {t("leaveTypes.actions.save")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
