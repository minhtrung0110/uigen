import { test, expect, vi, beforeEach, describe } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuth } from "../use-auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAuth — initial state", () => {
  test("isLoading starts as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn and signUp functions", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
  });
});

describe("useAuth — signIn", () => {
  test("sets isLoading to true while in-flight, then false after", async () => {
    let resolveAction!: (v: unknown) => void;
    (signInAction as any).mockReturnValue(
      new Promise((r) => { resolveAction = r; })
    );

    const { result } = renderHook(() => useAuth());

    let signInPromise: Promise<unknown>;
    act(() => {
      signInPromise = result.current.signIn("a@b.com", "pass");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveAction({ success: false });
      await signInPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("returns the result from signInAction", async () => {
    (signInAction as any).mockResolvedValue({ success: false, error: "Bad credentials" });

    const { result } = renderHook(() => useAuth());

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.signIn("a@b.com", "wrong");
    });

    expect(returnValue).toEqual({ success: false, error: "Bad credentials" });
  });

  test("does not navigate when signIn fails", async () => {
    (signInAction as any).mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "wrong");
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  test("calls signInAction with provided credentials", async () => {
    (signInAction as any).mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("user@example.com", "secret");
    });

    expect(signInAction).toHaveBeenCalledWith("user@example.com", "secret");
  });

  test("isLoading is false even when signInAction throws", async () => {
    (signInAction as any).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pass").catch(() => {});
    });

    expect(result.current.isLoading).toBe(false);
  });
});

describe("useAuth — signUp", () => {
  test("sets isLoading to true while in-flight, then false after", async () => {
    let resolveAction!: (v: unknown) => void;
    (signUpAction as any).mockReturnValue(
      new Promise((r) => { resolveAction = r; })
    );

    const { result } = renderHook(() => useAuth());

    let signUpPromise: Promise<unknown>;
    act(() => {
      signUpPromise = result.current.signUp("a@b.com", "pass");
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveAction({ success: false });
      await signUpPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("returns the result from signUpAction", async () => {
    (signUpAction as any).mockResolvedValue({ success: true });

    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "proj-1" });

    const { result } = renderHook(() => useAuth());

    let returnValue: unknown;
    await act(async () => {
      returnValue = await result.current.signUp("new@user.com", "pass");
    });

    expect(returnValue).toEqual({ success: true });
  });

  test("does not navigate when signUp fails", async () => {
    (signUpAction as any).mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signUp("a@b.com", "pass");
    });

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe("useAuth — handlePostSignIn (anon work present)", () => {
  test("creates project with anon work and redirects to it", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue({
      messages: [{ role: "user", content: "hello" }],
      fileSystemData: { "/": {} },
    });
    (createProject as any).mockResolvedValue({ id: "anon-proj-42" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hello" }],
        data: { "/": {} },
      })
    );
    expect(clearAnonWork).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/anon-proj-42");
  });

  test("does not call getProjects when anon work is present", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue({
      messages: [{ role: "user", content: "hi" }],
      fileSystemData: {},
    });
    (createProject as any).mockResolvedValue({ id: "proj-x" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(getProjects).not.toHaveBeenCalled();
  });
});

describe("useAuth — handlePostSignIn (no anon work, existing projects)", () => {
  test("redirects to the most recent project", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([
      { id: "recent-proj" },
      { id: "older-proj" },
    ]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(mockPush).toHaveBeenCalledWith("/recent-proj");
    expect(createProject).not.toHaveBeenCalled();
  });

  test("does not create a project if one already exists", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue({ messages: [], fileSystemData: {} });
    (getProjects as any).mockResolvedValue([{ id: "existing-proj" }]);

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(createProject).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/existing-proj");
  });
});

describe("useAuth — handlePostSignIn (no anon work, no projects)", () => {
  test("creates a new project and redirects to it", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "brand-new" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [], data: {} })
    );
    expect(mockPush).toHaveBeenCalledWith("/brand-new");
  });

  test("new project name starts with 'New Design'", async () => {
    (signInAction as any).mockResolvedValue({ success: true });
    (getAnonWorkData as any).mockReturnValue(null);
    (getProjects as any).mockResolvedValue([]);
    (createProject as any).mockResolvedValue({ id: "p1" });

    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.signIn("a@b.com", "pass");
    });

    const callArg = (createProject as any).mock.calls[0][0];
    expect(callArg.name).toMatch(/^New Design/);
  });
});
