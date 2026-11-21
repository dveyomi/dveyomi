import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeletedNotice } from "./DeletedNotice";

describe("DeletedNotice", () => {
  it("confirms the deletion after /login?deleted=1", async () => {
    render(await DeletedNotice({ searchParams: Promise.resolve({ deleted: "1" }) }));
    expect(screen.getByRole("status")).toHaveTextContent("Your account and all your data have been deleted.");
  });

  it("shows nothing otherwise", async () => {
    const { container } = render((await DeletedNotice({ searchParams: Promise.resolve({}) })) ?? <></>);
    expect(container).toBeEmptyDOMElement();
  });
});
