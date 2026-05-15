import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Dependency-free HTTP API for the Java calculator.
 *
 * Endpoint:
 *   POST /api/calculate
 * Body:
 *   {"left":10,"operator":"+","right":5}
 */
public class CalculatorBackend {
    private static final int DEFAULT_PORT = 8080;
    private static final Pattern JSON_FIELD_PATTERN = Pattern.compile(
            "\\\"([^\\\"]+)\\\"\\s*:\\s*(\\\"(?:[^\\\\\\\"]|\\\\.)*\\\"|-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?|true|false|null)"
    );

    public static void main(String[] args) throws IOException {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : DEFAULT_PORT;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/calculate", new CalculateHandler());
        server.createContext("/health", new HealthHandler());
        server.setExecutor(null);
        server.start();
        System.out.printf("Calculator backend listening on http://localhost:%d%n", port);
    }

    static CalculationResponse calculate(CalculationRequest request) {
        if (request == null) {
            return CalculationResponse.error("INVALID_INPUT", "Request body is required.");
        }
        if (request.operator == null || request.operator.isBlank()) {
            return CalculationResponse.error("INVALID_OPERATOR", "operator is required and must be one of +, -, *, /.");
        }
        if (request.left == null) {
            return CalculationResponse.error("INVALID_INPUT", "left is required and must be a finite number.");
        }
        if (request.right == null) {
            return CalculationResponse.error("INVALID_INPUT", "right is required and must be a finite number.");
        }
        if (!isFinite(request.left) || !isFinite(request.right)) {
            return CalculationResponse.error("INVALID_INPUT", "left and right must be finite numbers.");
        }

        try {
            double result = Calculator.calculate(request.left, request.right, request.operator);
            if (!isFinite(result)) {
                return CalculationResponse.error("CALCULATION_ERROR", "Calculation result is not finite.");
            }
            return CalculationResponse.success(result);
        } catch (IllegalArgumentException exception) {
            if ("/".equals(request.operator) && request.right == 0.0d) {
                return CalculationResponse.error("DIVISION_BY_ZERO", "Cannot divide by zero.");
            }
            return CalculationResponse.error("INVALID_OPERATOR", "operator must be one of +, -, *, /.");
        }
    }

    private static boolean isFinite(Double value) {
        return value != null && !value.isNaN() && !value.isInfinite();
    }

    static CalculationRequest parseRequest(String json) {
        if (json == null || json.isBlank()) {
            throw new IllegalArgumentException("Request body must be valid JSON.");
        }

        Map<String, String> fields = new HashMap<>();
        Matcher matcher = JSON_FIELD_PATTERN.matcher(json);
        while (matcher.find()) {
            fields.put(matcher.group(1), matcher.group(2));
        }

        if (fields.isEmpty()) {
            throw new IllegalArgumentException("Request body must be a JSON object with left, operator, and right fields.");
        }

        Double left = parseNumber(fields.get("left"));
        Double right = parseNumber(fields.get("right"));
        String operator = parseString(fields.get("operator"));
        return new CalculationRequest(left, operator, right);
    }

    private static Double parseNumber(String rawValue) {
        if (rawValue == null || rawValue.startsWith("\"")) {
            return null;
        }
        try {
            double value = Double.parseDouble(rawValue);
            return isFinite(value) ? value : null;
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private static String parseString(String rawValue) {
        if (rawValue == null || !rawValue.startsWith("\"") || rawValue.length() < 2) {
            return null;
        }
        String unquoted = rawValue.substring(1, rawValue.length() - 1);
        return unquoted.replace("\\\"", "\"").replace("\\\\", "\\");
    }

    static String successJson(double result) {
        return "{\"success\":true,\"result\":" + formatDouble(result) + "}";
    }

    static String errorJson(String code, String message) {
        return "{\"success\":false,\"error\":{\"code\":\"" + escapeJson(code) + "\",\"message\":\"" + escapeJson(message) + "\"}}";
    }

    private static String formatDouble(double value) {
        return BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
    }

    private static String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static void writeJson(HttpExchange exchange, int statusCode, String json) throws IOException {
        byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
        Headers headers = exchange.getResponseHeaders();
        headers.set("Content-Type", "application/json; charset=utf-8");
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Content-Type");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream responseBody = exchange.getResponseBody()) {
            responseBody.write(bytes);
        }
    }

    static class CalculateHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
                writeJson(exchange, 204, "");
                return;
            }
            if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                writeJson(exchange, 405, errorJson("METHOD_NOT_ALLOWED", "Use POST /api/calculate."));
                return;
            }

            String requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            CalculationResponse response;
            try {
                response = calculate(parseRequest(requestBody));
            } catch (IllegalArgumentException exception) {
                response = CalculationResponse.error("INVALID_JSON", exception.getMessage());
            }

            int statusCode = response.success ? 200 : httpStatusForError(response.errorCode);
            String json = response.success ? successJson(response.result) : errorJson(response.errorCode, response.errorMessage);
            writeJson(exchange, statusCode, json);
        }
    }

    static class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            writeJson(exchange, 200, "{\"status\":\"ok\"}");
        }
    }

    private static int httpStatusForError(String errorCode) {
        return switch (errorCode) {
            case "DIVISION_BY_ZERO", "INVALID_INPUT", "INVALID_OPERATOR", "INVALID_JSON" -> 400;
            default -> 500;
        };
    }

    static class CalculationRequest {
        final Double left;
        final String operator;
        final Double right;

        CalculationRequest(Double left, String operator, Double right) {
            this.left = left;
            this.operator = operator;
            this.right = right;
        }
    }

    static class CalculationResponse {
        final boolean success;
        final double result;
        final String errorCode;
        final String errorMessage;

        private CalculationResponse(boolean success, double result, String errorCode, String errorMessage) {
            this.success = success;
            this.result = result;
            this.errorCode = errorCode;
            this.errorMessage = errorMessage;
        }

        static CalculationResponse success(double result) {
            return new CalculationResponse(true, result, null, null);
        }

        static CalculationResponse error(String code, String message) {
            return new CalculationResponse(false, 0.0d, code, message);
        }
    }
}
