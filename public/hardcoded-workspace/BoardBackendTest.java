public class BoardBackendTest {
    public static void main(String[] args) {
        BoardBackend backend = new BoardBackend();

        BoardBackend.PostInput parsed = BoardBackend.parsePostInput(
                "{\"title\":\"Hello\\nBoard\",\"content\":\"First post\",\"author\":\"Kim\"}"
        );
        assertEquals("Hello\nBoard", parsed.title);
        assertEquals("First post", parsed.content);
        assertEquals("Kim", parsed.author);

        BoardBackend.ApiResponse created = backend.createPost(parsed);
        assertEquals(201, created.statusCode);
        assertContains(created.json, "\"success\":true");
        assertContains(created.json, "\"id\":1");
        assertContains(created.json, "\"title\":\"Hello\\nBoard\"");

        BoardBackend.ApiResponse list = backend.listPosts();
        assertEquals(200, list.statusCode);
        assertContains(list.json, "\"count\":1");

        BoardBackend.ApiResponse detail = backend.getPost(1);
        assertEquals(200, detail.statusCode);
        assertContains(detail.json, "\"author\":\"Kim\"");

        BoardBackend.ApiResponse updated = backend.updatePost(1, new BoardBackend.PostInput("Updated", "Changed content", null));
        assertEquals(200, updated.statusCode);
        assertContains(updated.json, "\"title\":\"Updated\"");
        assertContains(updated.json, "\"author\":\"anonymous\"");

        assertError(400, "INVALID_TITLE", backend.createPost(new BoardBackend.PostInput("", "content", "author")));
        assertError(400, "INVALID_CONTENT", backend.createPost(new BoardBackend.PostInput("title", " ", "author")));
        assertError(400, "INVALID_AUTHOR", backend.createPost(new BoardBackend.PostInput("title", "content", " ")));
        assertError(404, "POST_NOT_FOUND", backend.getPost(999));
        assertError(404, "POST_NOT_FOUND", backend.updatePost(999, new BoardBackend.PostInput("Updated", "Changed", "Kim")));

        BoardBackend.ApiResponse deleted = backend.deletePost(1);
        assertEquals(200, deleted.statusCode);
        assertContains(deleted.json, "\"deleted\":true");
        assertError(404, "POST_NOT_FOUND", backend.getPost(1));

        boolean invalidJsonThrown = false;
        try {
            BoardBackend.parsePostInput("not-json");
        } catch (IllegalArgumentException exception) {
            invalidJsonThrown = true;
        }
        if (!invalidJsonThrown) {
            throw new AssertionError("Expected invalid JSON to throw IllegalArgumentException");
        }

        System.out.println("BoardBackendTest passed");
    }

    private static void assertError(int expectedStatus, String expectedCode, BoardBackend.ApiResponse response) {
        assertEquals(expectedStatus, response.statusCode);
        assertContains(response.json, "\"success\":false");
        assertContains(response.json, "\"code\":\"" + expectedCode + "\"");
    }

    private static void assertContains(String actual, String expectedFragment) {
        if (!actual.contains(expectedFragment)) {
            throw new AssertionError("Expected [" + actual + "] to contain [" + expectedFragment + "]");
        }
    }

    private static void assertEquals(int expected, int actual) {
        if (expected != actual) {
            throw new AssertionError("Expected [" + expected + "] but got [" + actual + "]");
        }
    }

    private static void assertEquals(String expected, String actual) {
        if (!expected.equals(actual)) {
            throw new AssertionError("Expected [" + expected + "] but got [" + actual + "]");
        }
    }
}
