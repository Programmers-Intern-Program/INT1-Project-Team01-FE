import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Dependency-free HTTP API for a simple bulletin board.
 *
 * Endpoints:
 *   GET    /api/posts
 *   GET    /api/posts/{id}
 *   POST   /api/posts
 *   PUT    /api/posts/{id}
 *   DELETE /api/posts/{id}
 */
public class BoardBackend {
    private static final int DEFAULT_PORT = 8081;
    private static final int MAX_TITLE_LENGTH = 100;
    private static final int MAX_CONTENT_LENGTH = 5000;
    private static final int MAX_AUTHOR_LENGTH = 50;
    private static final Pattern JSON_STRING_FIELD_PATTERN = Pattern.compile(
            "\\\"([^\\\"]+)\\\"\\s*:\\s*\\\"((?:[^\\\\\\\"]|\\\\.)*)\\\""
    );

    private final PostStore store;

    public BoardBackend() {
        this(new PostStore());
    }

    BoardBackend(PostStore store) {
        this.store = store;
    }

    public static void main(String[] args) throws IOException {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : DEFAULT_PORT;
        BoardBackend backend = new BoardBackend();
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/posts", backend.new PostsHandler());
        server.createContext("/health", new HealthHandler());
        server.setExecutor(null);
        server.start();
        System.out.printf("Board backend listening on http://localhost:%d%n", port);
    }

    ApiResponse listPosts() {
        List<Post> posts = store.list();
        StringBuilder json = new StringBuilder();
        json.append("{\"success\":true,\"data\":[");
        for (int i = 0; i < posts.size(); i++) {
            if (i > 0) {
                json.append(',');
            }
            json.append(postJson(posts.get(i)));
        }
        json.append("],\"count\":").append(posts.size()).append('}');
        return ApiResponse.success(200, json.toString());
    }

    ApiResponse getPost(long id) {
        Post post = store.get(id);
        if (post == null) {
            return ApiResponse.error(404, "POST_NOT_FOUND", "Post not found.");
        }
        return ApiResponse.success(200, "{\"success\":true,\"data\":" + postJson(post) + "}");
    }

    ApiResponse createPost(PostInput input) {
        ValidationError validationError = validate(input, true);
        if (validationError != null) {
            return ApiResponse.error(400, validationError.code, validationError.message);
        }
        Post post = store.create(input.title.trim(), input.content.trim(), normalizedAuthor(input.author));
        return ApiResponse.success(201, "{\"success\":true,\"data\":" + postJson(post) + "}");
    }

    ApiResponse updatePost(long id, PostInput input) {
        ValidationError validationError = validate(input, true);
        if (validationError != null) {
            return ApiResponse.error(400, validationError.code, validationError.message);
        }
        Post post = store.update(id, input.title.trim(), input.content.trim(), normalizedAuthor(input.author));
        if (post == null) {
            return ApiResponse.error(404, "POST_NOT_FOUND", "Post not found.");
        }
        return ApiResponse.success(200, "{\"success\":true,\"data\":" + postJson(post) + "}");
    }

    ApiResponse deletePost(long id) {
        boolean deleted = store.delete(id);
        if (!deleted) {
            return ApiResponse.error(404, "POST_NOT_FOUND", "Post not found.");
        }
        return ApiResponse.success(200, "{\"success\":true,\"data\":{\"id\":" + id + ",\"deleted\":true}}");
    }

    static PostInput parsePostInput(String json) {
        if (json == null || json.isBlank()) {
            throw new IllegalArgumentException("Request body must be a JSON object.");
        }
        String trimmed = json.trim();
        if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
            throw new IllegalArgumentException("Request body must be a JSON object.");
        }

        Map<String, String> fields = new LinkedHashMap<>();
        Matcher matcher = JSON_STRING_FIELD_PATTERN.matcher(trimmed);
        while (matcher.find()) {
            fields.put(matcher.group(1), unescapeJsonString(matcher.group(2)));
        }
        if (fields.isEmpty()) {
            throw new IllegalArgumentException("Request body must include string fields: title, content, and optional author.");
        }
        return new PostInput(fields.get("title"), fields.get("content"), fields.get("author"));
    }

    private static ValidationError validate(PostInput input, boolean requireAll) {
        if (input == null) {
            return new ValidationError("INVALID_JSON", "Request body is required.");
        }
        if (requireAll && isBlank(input.title)) {
            return new ValidationError("INVALID_TITLE", "title is required and must be 1-100 characters.");
        }
        if (input.title != null && (input.title.trim().isEmpty() || input.title.trim().length() > MAX_TITLE_LENGTH)) {
            return new ValidationError("INVALID_TITLE", "title must be 1-100 characters.");
        }
        if (requireAll && isBlank(input.content)) {
            return new ValidationError("INVALID_CONTENT", "content is required and must be 1-5000 characters.");
        }
        if (input.content != null && (input.content.trim().isEmpty() || input.content.trim().length() > MAX_CONTENT_LENGTH)) {
            return new ValidationError("INVALID_CONTENT", "content must be 1-5000 characters.");
        }
        if (input.author != null && (input.author.trim().isEmpty() || input.author.trim().length() > MAX_AUTHOR_LENGTH)) {
            return new ValidationError("INVALID_AUTHOR", "author must be 1-50 characters when provided.");
        }
        return null;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private static String normalizedAuthor(String author) {
        return isBlank(author) ? "anonymous" : author.trim();
    }

    private static Long parseId(String path) {
        String prefix = "/api/posts/";
        if (path == null || !path.startsWith(prefix) || path.length() <= prefix.length()) {
            return null;
        }
        String rawId = path.substring(prefix.length());
        if (rawId.contains("/")) {
            return null;
        }
        try {
            long id = Long.parseLong(rawId);
            return id > 0 ? id : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    static String postJson(Post post) {
        return "{"
                + "\"id\":" + post.id + ","
                + "\"title\":\"" + escapeJson(post.title) + "\","
                + "\"content\":\"" + escapeJson(post.content) + "\","
                + "\"author\":\"" + escapeJson(post.author) + "\","
                + "\"createdAt\":\"" + escapeJson(post.createdAt) + "\","
                + "\"updatedAt\":\"" + escapeJson(post.updatedAt) + "\""
                + "}";
    }

    static String errorJson(String code, String message) {
        return "{\"success\":false,\"error\":{\"code\":\"" + escapeJson(code) + "\",\"message\":\"" + escapeJson(message) + "\"}}";
    }

    private static String escapeJson(String value) {
        return value == null ? "" : value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private static String unescapeJsonString(String value) {
        StringBuilder result = new StringBuilder();
        boolean escaping = false;
        for (int i = 0; i < value.length(); i++) {
            char character = value.charAt(i);
            if (escaping) {
                switch (character) {
                    case 'n' -> result.append('\n');
                    case 'r' -> result.append('\r');
                    case 't' -> result.append('\t');
                    case '\\' -> result.append('\\');
                    case '\"' -> result.append('\"');
                    default -> result.append(character);
                }
                escaping = false;
            } else if (character == '\\') {
                escaping = true;
            } else {
                result.append(character);
            }
        }
        if (escaping) {
            result.append('\\');
        }
        return result.toString();
    }

    private static void writeJson(HttpExchange exchange, int statusCode, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        Headers headers = exchange.getResponseHeaders();
        headers.set("Content-Type", "application/json; charset=utf-8");
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream responseBody = exchange.getResponseBody()) {
            responseBody.write(bytes);
        }
    }

    class PostsHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                writeJson(exchange, 204, "");
                return;
            }

            String method = exchange.getRequestMethod().toUpperCase();
            String path = exchange.getRequestURI().getPath();
            ApiResponse response;

            try {
                if ("/api/posts".equals(path) || "/api/posts/".equals(path)) {
                    response = handleCollection(method, exchange);
                } else {
                    Long id = parseId(path);
                    if (id == null) {
                        response = ApiResponse.error(404, "NOT_FOUND", "Endpoint not found.");
                    } else {
                        response = handleItem(method, id, exchange);
                    }
                }
            } catch (IllegalArgumentException exception) {
                response = ApiResponse.error(400, "INVALID_JSON", exception.getMessage());
            }

            writeJson(exchange, response.statusCode, response.json);
        }

        private ApiResponse handleCollection(String method, HttpExchange exchange) throws IOException {
            return switch (method) {
                case "GET" -> listPosts();
                case "POST" -> createPost(parsePostInput(readBody(exchange)));
                default -> ApiResponse.error(405, "METHOD_NOT_ALLOWED", "Use GET or POST for /api/posts.");
            };
        }

        private ApiResponse handleItem(String method, long id, HttpExchange exchange) throws IOException {
            return switch (method) {
                case "GET" -> getPost(id);
                case "PUT" -> updatePost(id, parsePostInput(readBody(exchange)));
                case "DELETE" -> deletePost(id);
                default -> ApiResponse.error(405, "METHOD_NOT_ALLOWED", "Use GET, PUT, or DELETE for /api/posts/{id}.");
            };
        }

        private String readBody(HttpExchange exchange) throws IOException {
            return new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    static class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            writeJson(exchange, 200, "{\"status\":\"ok\"}");
        }
    }

    static class PostStore {
        private final AtomicLong nextId = new AtomicLong(1);
        private final Map<Long, Post> posts = new ConcurrentHashMap<>();

        List<Post> list() {
            List<Post> result = new ArrayList<>(posts.values());
            result.sort(Comparator.comparingLong((Post post) -> post.id).reversed());
            return result;
        }

        Post get(long id) {
            return posts.get(id);
        }

        Post create(String title, String content, String author) {
            long id = nextId.getAndIncrement();
            String now = Instant.now().toString();
            Post post = new Post(id, title, content, author, now, now);
            posts.put(id, post);
            return post;
        }

        Post update(long id, String title, String content, String author) {
            Post current = posts.get(id);
            if (current == null) {
                return null;
            }
            Post updated = new Post(id, title, content, author, current.createdAt, Instant.now().toString());
            posts.put(id, updated);
            return updated;
        }

        boolean delete(long id) {
            return posts.remove(id) != null;
        }
    }

    static class Post {
        final long id;
        final String title;
        final String content;
        final String author;
        final String createdAt;
        final String updatedAt;

        Post(long id, String title, String content, String author, String createdAt, String updatedAt) {
            this.id = id;
            this.title = title;
            this.content = content;
            this.author = author;
            this.createdAt = createdAt;
            this.updatedAt = updatedAt;
        }
    }

    static class PostInput {
        final String title;
        final String content;
        final String author;

        PostInput(String title, String content, String author) {
            this.title = title;
            this.content = content;
            this.author = author;
        }
    }

    static class ApiResponse {
        final int statusCode;
        final String json;

        private ApiResponse(int statusCode, String json) {
            this.statusCode = statusCode;
            this.json = json;
        }

        static ApiResponse success(int statusCode, String json) {
            return new ApiResponse(statusCode, json);
        }

        static ApiResponse error(int statusCode, String code, String message) {
            return new ApiResponse(statusCode, errorJson(code, message));
        }
    }

    static class ValidationError {
        final String code;
        final String message;

        ValidationError(String code, String message) {
            this.code = code;
            this.message = message;
        }
    }
}
