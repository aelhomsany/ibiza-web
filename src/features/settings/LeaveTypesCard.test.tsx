import { LEAVE_TYPE_DEFAULT_PRESENTATION } from "./leaveTypeDefaults";
import { isolate } from "../../i18n/bidi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import * as apiClient from "../../api/client";
import type { LeaveTypeResponse } from "../../api/generated/types";
import {
  AuthTestProvider,
  createMockAuthForRole,
} from "../../test/authTestUtils";
import { MemoryRouter, useLocation } from "react-router-dom";
import { LeaveTypesCard } from "./LeaveTypesCard";

const mockLeaveTypes: LeaveTypeResponse[] = [
  {
    id: 1,
    name: "Annual Leave",
    icon: "🏖️",
    color: "#093C5D",
    backgroundColor: "#D6E8ED",
    borderColor: "#0E4F75",
    defaultBalanceDays: 20,
    displayOrder: 1,
  },
  {
    id: 2,
    name: "Sick Leave",
    icon: "🤒",
    color: "#EF4444",
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    defaultBalanceDays: 10,
    displayOrder: 2,
  },
  {
    id: 3,
    name: "Work From Home",
    icon: "🏠",
    color: "#2D6A4F",
    backgroundColor: "#E4F5DC",
    borderColor: "#CBF3BB",
    defaultBalanceDays: 30,
    displayOrder: 3,
  },
  {
    id: 4,
    name: "Maternity/Paternity",
    icon: "👶",
    color: "#854D0E",
    backgroundColor: "#FEF9C3",
    borderColor: "#FDE68A",
    defaultBalanceDays: 90,
    displayOrder: 4,
  },
  {
    id: 5,
    name: "Unpaid Leave",
    icon: "📋",
    color: "#5A7A80",
    backgroundColor: "#ECF4E8",
    borderColor: "#B8DCC4",
    defaultBalanceDays: null,
    displayOrder: 5,
  },
];

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function renderLeaveTypesCard(onWarning = vi.fn(), onSuccess = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthTestProvider value={createMockAuthForRole("HR_ADMIN")}>
          <LeaveTypesCard onWarning={onWarning} onSuccess={onSuccess} />
          <LocationProbe />
        </AuthTestProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LeaveTypesCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state while leave types fetch", () => {
    vi.spyOn(apiClient, "getManagedLeaveTypes").mockImplementation(
      () => new Promise(() => {}),
    );

    renderLeaveTypesCard();

    expect(screen.getByTestId("leave-types-card")).toBeInTheDocument();
    expect(screen.getByText("Loading leave types…")).toBeInTheDocument();
  });

  it("renders five leave types with capped and uncapped copy", async () => {
    vi.spyOn(apiClient, "getManagedLeaveTypes").mockResolvedValue(
      mockLeaveTypes,
    );
    vi.spyOn(apiClient, "getPolicySettingsOverview").mockResolvedValue({
      leaveTypes: [],
      users: [],
      workforceGroups: [],
    });

    renderLeaveTypesCard();

    await waitFor(() => {
      expect(screen.getByTestId("leave-types-list")).toBeInTheDocument();
    });

    expect(screen.getByText("Annual Leave")).toBeInTheDocument();
    expect(screen.getByText("20 days default")).toBeInTheDocument();
    expect(screen.getByText("Sick Leave")).toBeInTheDocument();
    expect(screen.getByText("10 days default")).toBeInTheDocument();
    expect(screen.getByText("Unpaid Leave")).toBeInTheDocument();
    expect(screen.getByText("Unlimited / custom")).toBeInTheDocument();
    expect(screen.getAllByTestId(/^leave-type-row-/)).toHaveLength(5);
  });

  it("calls onWarning when leave types fail to load", async () => {
    const onWarning = vi.fn();
    vi.spyOn(apiClient, "getManagedLeaveTypes").mockRejectedValue(
      new Error("fail"),
    );
    vi.spyOn(apiClient, "getPolicySettingsOverview").mockResolvedValue({
      leaveTypes: [],
      users: [],
      workforceGroups: [],
    });

    renderLeaveTypesCard(onWarning);

    await waitFor(() => {
      expect(onWarning).toHaveBeenCalledWith("Unable to load leave types");
    });
  });

  it("[P0] exposes named lifecycle actions and has no destructive delete path", async () => {
    const user = userEvent.setup();
    vi.spyOn(apiClient, "getManagedLeaveTypes").mockResolvedValue(
      mockLeaveTypes.map((item) => ({
        ...item,
        publicId: `public-${item.id}`,
        presenceType: "OFF",
        active: true,
      })),
    );
    vi.spyOn(apiClient, "getPolicySettingsOverview").mockResolvedValue({
      leaveTypes: [],
      users: [],
      workforceGroups: [],
    });
    vi.spyOn(apiClient, "deactivateLeaveType").mockResolvedValue({
      ...mockLeaveTypes[0],
      publicId: "public-1",
      presenceType: "OFF",
      active: false,
    });

    renderLeaveTypesCard();

    await user.click(
      await screen.findByRole("button", { name: `Deactivate ${isolate("Annual Leave")}` }),
    );
    expect(await screen.findByRole("dialog")).toHaveTextContent("Annual Leave");
    await user.click(
      screen.getByRole("button", { name: /confirm deactivation/i }),
    );
    await waitFor(() =>
      expect(apiClient.deactivateLeaveType).toHaveBeenCalledWith("public-1"),
    );
    expect(
      screen.queryByRole("button", { name: `Delete ${isolate("Annual Leave")}` }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add leave type/i }),
    ).toBeInTheDocument();
  });

  it("[P0] creates and edits catalogue entries while retaining modal input after failures", async () => {
    const user = userEvent.setup();
    const onWarning = vi.fn();
    const types = mockLeaveTypes
      .slice(0, 1)
      .map((item) => ({
        ...item,
        publicId: "public-1",
        presenceType: "OFF" as const,
        active: true,
      }));
    vi.spyOn(apiClient, "getManagedLeaveTypes").mockResolvedValue(types);
    vi.spyOn(apiClient, "getPolicySettingsOverview").mockResolvedValue({
      leaveTypes: [],
      users: [],
      workforceGroups: [],
    });
    const create = vi
      .spyOn(apiClient, "createLeaveType")
      .mockRejectedValueOnce(
        new apiClient.ApiError(400, {
          type: "https://ibiza.app/errors/validation-failed",
          title: "Validation failed",
          status: 400,
          violations: [{ field: "name", message: "name already exists" }],
        }),
      )
      .mockResolvedValueOnce(types[0]);
    const update = vi
      .spyOn(apiClient, "updateLeaveType")
      .mockRejectedValueOnce(
        new apiClient.ApiError(400, {
          type: "https://ibiza.app/errors/validation-failed",
          title: "Validation failed",
          status: 400,
          violations: [{ field: "icon", message: "icon is invalid" }],
        }),
      )
      .mockResolvedValueOnce({ ...types[0], name: "Annual Rest" });
    renderLeaveTypesCard(onWarning);

    await user.click(
      await screen.findByRole("button", { name: /add leave type/i }),
    );
    await user.type(screen.getByLabelText(/^name$/i), "Compassionate Leave");
    await user.type(screen.getByLabelText(/^icon$/i), "C");
    await user.click(
      screen.getByRole("button", { name: /create leave type/i }),
    );
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(create).toHaveBeenCalledWith({
      name: "Compassionate Leave",
      icon: "C",
      color: LEAVE_TYPE_DEFAULT_PRESENTATION.color,
      backgroundColor: LEAVE_TYPE_DEFAULT_PRESENTATION.backgroundColor,
      borderColor: LEAVE_TYPE_DEFAULT_PRESENTATION.borderColor,
      presenceType: LEAVE_TYPE_DEFAULT_PRESENTATION.presenceType,
    });
    expect(screen.getByLabelText(/^name$/i)).toHaveValue("Compassionate Leave");
    expect(screen.getByText("name already exists")).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toHaveFocus();
    expect(onWarning).toHaveBeenCalledWith("Unable to create leave type");
    await user.click(
      screen.getByRole("button", { name: /create leave type/i }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole("button", { name: `Edit ${isolate("Annual Leave")}` }),
    );
    const name = screen.getByLabelText(/^name$/i);
    await user.clear(name);
    await user.type(name, "Annual Rest");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    // The edit must target the row that was opened and carry every presentation field, not just
    // the one the user touched.
    expect(update).toHaveBeenCalledWith(
      "public-1",
      expect.objectContaining({
        name: "Annual Rest",
        icon: types[0].icon,
        color: types[0].color,
        backgroundColor: types[0].backgroundColor,
        borderColor: types[0].borderColor,
        presenceType: types[0].presenceType,
      }),
    );
    expect(name).toHaveValue("Annual Rest");
    expect(screen.getByText("icon is invalid")).toBeInTheDocument();
    expect(screen.getByLabelText(/^icon$/i)).toHaveFocus();
    expect(onWarning).toHaveBeenCalledWith("Unable to update leave type");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
  });

  it("[P0] reorders without losing displayed order on failure and deactivates/reactivates without delete", async () => {
    const user = userEvent.setup();
    const onWarning = vi.fn();
    const types = mockLeaveTypes
      .slice(0, 2)
      .map((item, index) => ({
        ...item,
        publicId: `public-${index + 1}`,
        presenceType: "OFF" as const,
        active: index === 0,
      }));
    vi.spyOn(apiClient, "getManagedLeaveTypes").mockResolvedValue(types);
    vi.spyOn(apiClient, "getPolicySettingsOverview").mockResolvedValue({
      leaveTypes: [],
      users: [],
      workforceGroups: [],
    });
    vi.spyOn(apiClient, "reorderLeaveTypes").mockRejectedValue(
      new Error("reorder"),
    );
    vi.spyOn(apiClient, "deactivateLeaveType").mockResolvedValue({
      ...types[0],
      active: false,
    });
    vi.spyOn(apiClient, "reactivateLeaveType").mockResolvedValue({
      ...types[1],
      active: true,
    });
    const onSuccess = vi.fn();
    renderLeaveTypesCard(onWarning, onSuccess);

    await user.click(
      await screen.findByRole("button", { name: `Move Down: ${isolate("Annual Leave")}` }),
    );
    // The swap itself must be asserted: without a payload assertion the reorder could send the
    // unmodified order, or swap the wrong neighbours, and this test would still pass.
    await waitFor(() =>
      expect(apiClient.reorderLeaveTypes).toHaveBeenCalledTimes(1),
    );
    expect(vi.mocked(apiClient.reorderLeaveTypes).mock.calls[0][0]).toEqual([
      "public-2",
      "public-1",
    ]);
    await waitFor(() =>
      expect(onWarning).toHaveBeenCalledWith("Unable to reorder leave types"),
    );
    expect(
      screen.getAllByTestId(/^leave-type-row-/).map((row) => row.textContent),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Annual Leave"),
        expect.stringContaining("Sick Leave"),
      ]),
    );
    expect(screen.getAllByTestId(/^leave-type-row-/)[0]).toHaveTextContent(
      "Annual Leave",
    );
    await user.click(
      screen.getByRole("button", { name: `Deactivate ${isolate("Annual Leave")}` }),
    );
    await user.click(
      screen.getByRole("button", { name: /confirm deactivation/i }),
    );
    await waitFor(() =>
      expect(apiClient.deactivateLeaveType).toHaveBeenCalledWith("public-1"),
    );
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith("Annual Leave deactivated"),
    );
    await user.click(
      screen.getByRole("button", { name: `Reactivate ${isolate("Sick Leave")}` }),
    );
    await user.click(
      screen.getByRole("button", { name: /confirm reactivation/i }),
    );
    await waitFor(() =>
      expect(apiClient.reactivateLeaveType).toHaveBeenCalledWith("public-2"),
    );
    // Repeated lifecycle actions must name the type they acted on, not just fire a toast.
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith("Sick Leave reactivated"),
    );
    expect(
      screen.queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
  });

  it("[P0] resumes the existing draft and creates then navigates when no draft exists", async () => {
    const user = userEvent.setup();
    const types = mockLeaveTypes
      .slice(0, 2)
      .map((item, index) => ({
        ...item,
        publicId: `public-${index + 1}`,
        presenceType: "OFF" as const,
        active: true,
      }));
    vi.spyOn(apiClient, "getManagedLeaveTypes").mockResolvedValue(types);
    vi.spyOn(apiClient, "getPolicySettingsOverview").mockResolvedValue({
      leaveTypes: [
        {
          ...types[0],
          leaveTypePublicId: "public-1",
          policyPublicId: "policy-1",
          latestDraft: { draftPublicId: "existing-draft", revision: 2 },
        },
        {
          ...types[1],
          leaveTypePublicId: "public-2",
          policyPublicId: "policy-2",
          latestDraft: null,
        },
      ],
      users: [],
      workforceGroups: [],
    });
    vi.spyOn(apiClient, "createPolicyDraft").mockResolvedValue({
      policyPublicId: "policy-2",
      draftPublicId: "new-draft",
      leaveTypePublicId: "public-2",
      mode: "ANNUAL_ALLOWANCE",
      allowanceDays: 10,
      balancePeriod: "CALENDAR_YEAR",
      scope: "ORGANIZATION",
      subjectPublicId: null,
      effectiveFrom: "2027-01-01",
      revision: 0,
      consumed: false,
    });
    const first = renderLeaveTypesCard();
    await user.click(
      await screen.findByRole("button", { name: /resume draft/i }),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/settings/leave-policies/existing-draft",
    );
    first.unmount();
    renderLeaveTypesCard();
    await user.click(
      await screen.findByRole("button", { name: /configure policy/i }),
    );
    await waitFor(() =>
      expect(apiClient.createPolicyDraft).toHaveBeenCalledWith(
        expect.objectContaining({ leaveTypePublicId: "public-2" }),
      ),
    );
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/settings/leave-policies/new-draft",
    );
  });

  it("[P0] blocks policy actions until failed overview retry restores authoritative resume/create choices", async () => {
    const user = userEvent.setup();
    const types = mockLeaveTypes.slice(0, 2).map((item, index) => ({
      ...item,
      publicId: `public-${index + 1}`,
      presenceType: "OFF" as const,
      active: true,
    }));
    vi.spyOn(apiClient, "getManagedLeaveTypes").mockResolvedValue(types);
    vi.spyOn(apiClient, "getPolicySettingsOverview")
      .mockRejectedValueOnce(new Error("overview"))
      .mockResolvedValueOnce({
        leaveTypes: [
          { ...types[0], leaveTypePublicId: "public-1", policyPublicId: "policy-1", latestDraft: { draftPublicId: "existing-draft", revision: 2 } },
          { ...types[1], leaveTypePublicId: "public-2", policyPublicId: "policy-2", latestDraft: null },
        ],
        users: [],
        workforceGroups: [],
      });
    const create = vi.spyOn(apiClient, "createPolicyDraft");
    renderLeaveTypesCard();

    expect(await screen.findByRole("alert")).toHaveTextContent(/policy actions are unavailable/i);
    const unavailable = screen.getAllByRole("button", { name: /configure policy/i });
    expect(unavailable).toHaveLength(2);
    unavailable.forEach((button) => expect(button).toBeDisabled());
    await user.click(unavailable[0]);
    expect(create).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /^retry$/i }));
    expect(await screen.findByRole("button", { name: /resume draft/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /configure policy/i })).toBeEnabled();
  });
});
